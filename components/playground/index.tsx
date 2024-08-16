"use client";

import React, { useEffect, useState } from "react";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  AspectRatioSelector,
  Ratio,
} from "@/components/playground/aspect-selector";
import { ModelSelector } from "@/components/playground/model-selector";
import { Model, models, types } from "@/components/playground/models";
import { PrivateSwitch } from "@/components/playground/private-switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Credits } from "@/config/constants";
import { FluxSelectDto } from "@/db/type";
import { cn } from "@/lib/utils";

import { Icons } from "../shared/icons";
import Loading from "./loading";

const aspectRatios = [Ratio.r1, Ratio.r2, Ratio.r3, Ratio.r4, Ratio.r5];

const useCreateTaskMutation = (config?: {
  onSuccess: (result: any) => void;
}) => {
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async (values: any) => {
      const res = await fetch("/api/generate", {
        body: JSON.stringify(values),
        method: "POST",
        headers: { Authorization: `Bearer ${await getToken()}` },
      });

      if (!res.ok) {
        throw new Error("Network response error");
      }

      return res.json();
    },
    onSuccess: async (result) => {
      config?.onSuccess(result);
    },
  });
};

export enum FluxTaskStatus {
  Processing = "processing",
  Succeeded = "succeeded",
  Failed = "failed",
  Canceled = "canceled",
}

export default function Playground({ locale }: { locale: string }) {
  const [isPublic, setIsPublic] = React.useState(true);
  const [selectedModel, setSelectedModel] = React.useState<Model>(models[0]);
  const [ratio, setRatio] = React.useState<Ratio>(Ratio.r1);
  const [inputPrompt, setInputPrompt] = React.useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fluxId, setFluxId] = useState("");
  const [fluxData, setFluxData] = useState<FluxSelectDto>();
  const useCreateTask = useCreateTaskMutation();
  const t = useTranslations("Playground");
  const { getToken } = useAuth();

  const queryTask = useQuery({
    queryKey: ["queryFluxTask", fluxId],
    enabled: !!fluxId,
    refetchInterval: (query) => {
      if (query.state.data?.data?.taskStatus === FluxTaskStatus.Processing) {
        return 2000;
      }
      return false;
    },
    queryFn: async () => {
      const res = await fetch("/api/task", {
        body: JSON.stringify({
          fluxId,
        }),
        method: "POST",
        headers: { Authorization: `Bearer ${await getToken()}` },
      });

      if (!res.ok) {
        throw new Error("Network response error");
      }

      return res.json();
    },
  });

  useEffect(() => {
    if (!queryTask.data?.data?.id) {
      return;
    }
    setFluxData(queryTask?.data?.data);
  }, [queryTask.data]);

  const handleSubmit = async () => {
    if (!inputPrompt) {
      return toast.error("Please enter a prompt");
    }
    setLoading(true);
    try {
      const res = await useCreateTask.mutateAsync({
        model: selectedModel.id,
        inputPrompt,
        aspectRatio: ratio,
        isPrivate: isPublic ? 0 : 1,
        locale,
      });
      console.log("res--->", res);
      if (!res.error) {
        setFluxId(res.id);
      } else {
        toast.error(res.error);
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-[0.5rem] border bg-background shadow">
      <div className="container h-full p-6">
        <div className="grid h-full items-stretch gap-6 md:grid-cols-[1fr_240px]">
          <div className="hidden flex-col space-y-4 sm:flex md:order-2">
            <ModelSelector
              selectedModel={selectedModel}
              onChange={(model) => setSelectedModel(model)}
              types={types}
              models={models}
            />
            <AspectRatioSelector ratio={ratio} onChange={setRatio} />
            {/* <TemperatureSelector defaultValue={[0.56]} /> */}
            {/* <MaxLengthSelector defaultValue={[256]} /> */}
          </div>
          <div className="md:order-1">
            <div className="flex flex-col space-y-4">
              <div className="grid h-full gap-6 lg:grid-cols-2">
                <div className="flex flex-col space-y-4">
                  <div className="flex flex-1 flex-col space-y-2">
                    <Label htmlFor="input">{t("form.input")}</Label>
                    <Textarea
                      id="input"
                      placeholder={t("form.placeholder")}
                      className="flex-1 lg:min-h-[320px]"
                      value={inputPrompt}
                      onChange={(e) => setInputPrompt(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-1 flex-col space-y-2">
                  <Label htmlFor="Result">{t("form.result")}</Label>
                  <div className="min-h-[400px] rounded-md border lg:min-h-[450px]">
                    {loading ||
                    ((queryTask.isPending ||
                      queryTask.isLoading ||
                      fluxData?.taskStatus === FluxTaskStatus.Processing) &&
                      fluxId) ? (
                      <div className="flex size-full items-center justify-center">
                        <Loading />
                      </div>
                    ) : (
                      <div
                        className={cn("size-full", {
                          "bg-muted": !fluxData?.imageUrl || !fluxId,
                        })}
                      >
                        {fluxData?.imageUrl && fluxId && (
                          <img
                            src={fluxData?.imageUrl}
                            alt="Generated Image"
                            className={`w-full rounded-md aspect-[${fluxData?.aspectRatio ? fluxData?.aspectRatio?.split(":").join("/") : "auto"}]`}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-5">
                <Button
                  className="w-40"
                  disabled={
                    !inputPrompt.length ||
                    loading ||
                    ((queryTask.isPending ||
                      queryTask.isLoading ||
                      fluxData?.taskStatus === FluxTaskStatus.Processing) &&
                      !!fluxId)
                  }
                  onClick={handleSubmit}
                >
                  {loading ? (
                    <>
                      <Icons.spinner className="mr-2 size-4 animate-spin" />{" "}
                      Loading...
                    </>
                  ) : (
                    <>
                      {t("form.submit")}
                    </>
                  )}
                </Button>
                <PrivateSwitch isPublic={isPublic} onChange={setIsPublic} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
