"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { toast } from "@repo/ui/hooks/use-toast";

import { createClient } from "~/lib/supabase-client";

const formSchema = z.object({
  type: z.enum(["image", "video", "text"]),
  engine: z.enum([
    "fal-ai/fast-sdxl",
    "fal-ai/fast-sdxl-turbo",
    "fal-ai/kling-video/v2/master/text-to-video",
    "openai/gpt-4o-mini",
  ]),
  prompt: z.string().min(1, "Prompt is required"),
});

type FormValues = z.infer<typeof formSchema>;

export function CreateTestEventDialog() {
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "image",
      engine: "fal-ai/fast-sdxl",
      prompt: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      const id = uuidv4();
      const client = createClient();

      const { error } = await client.from("resource").insert({
        id,
        type: data.type,
        engine: data.engine,
        status: "init",
        data: { prompt: data.prompt },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Test event created successfully",
      });

      setOpen(false);
      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create test event",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Create Test Event</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Test Event</DialogTitle>
          <DialogDescription>
            Create a test event to simulate different resource types and states.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="engine"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Engine</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an engine" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="fal-ai/fast-sdxl">SDXL</SelectItem>
                      <SelectItem value="fal-ai/fast-sdxl-turbo">
                        SDXL Turbo
                      </SelectItem>
                      <SelectItem value="fal-ai/kling-video/v2/master/text-to-video">
                        Kling Video
                      </SelectItem>
                      <SelectItem value="openai/gpt-4o-mini">
                        GPT-4 Mini
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your prompt" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Create Event</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
