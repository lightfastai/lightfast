"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import { ExpressionInput } from "../ui/expression-input";
import { ExpressionVector2Input } from "../ui/expression-vector2-input";

// Schema for the form - should match the NoiseTexture schema
const formSchema = z.object({
  u_period: z.union([z.number(), z.string()]),
  u_harmonics: z.number().int().min(0).max(8),
  u_harmonic_gain: z.union([z.number(), z.string()]),
  u_harmonic_spread: z.union([z.number(), z.string()]),
  u_amplitude: z.union([z.number(), z.string()]),
  u_offset: z.union([z.number(), z.string()]),
  u_exponent: z.union([z.number(), z.string()]),
  timeExpression: z.string(),
  u_scale: z.object({
    x: z.union([z.number(), z.string()]),
    y: z.union([z.number(), z.string()]),
  }),
  u_translate: z.object({
    x: z.union([z.number(), z.string()]),
    y: z.union([z.number(), z.string()]),
  }),
  u_rotation: z.object({
    x: z.union([z.number(), z.string()]),
    y: z.union([z.number(), z.string()]),
  }),
});

type NoiseTextureFormValues = z.infer<typeof formSchema>;

interface NoiseTextureFormProps {
  defaultValues?: Partial<NoiseTextureFormValues>;
  onSubmit: (values: NoiseTextureFormValues) => void;
}

export function NoiseTextureForm({
  defaultValues = {
    u_period: 2.0,
    u_harmonics: 1,
    u_harmonic_gain: 0.66,
    u_harmonic_spread: 2.0,
    u_amplitude: 0.84,
    u_offset: 0.412,
    u_exponent: 0.63,
    timeExpression: "time * 0.1",
    u_scale: { x: 1, y: 1 },
    u_translate: { x: 0, y: 0 },
    u_rotation: { x: 0, y: 0 },
  },
  onSubmit,
}: NoiseTextureFormProps) {
  const form = useForm<NoiseTextureFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Noise Settings</CardTitle>
            <CardDescription>
              Configure the noise texture properties. Toggle between numeric
              values and expressions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Properties */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="u_period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period</FormLabel>
                    <FormControl>
                      <ExpressionInput
                        value={field.value}
                        onChange={field.onChange}
                        min={0.01}
                        max={5}
                        step={0.01}
                      />
                    </FormControl>
                    <FormDescription>
                      Controls the frequency of the noise (1/period).
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="u_harmonics"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Harmonics</FormLabel>
                    <FormControl>
                      <Slider
                        value={[field.value]}
                        min={0}
                        max={8}
                        step={1}
                        onValueChange={(vals) => field.onChange(vals[0])}
                        className="mt-6"
                      />
                    </FormControl>
                    <FormDescription>
                      Number of noise iterations (0-8).
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="u_harmonic_gain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Harmonic Gain</FormLabel>
                    <FormControl>
                      <ExpressionInput
                        value={field.value}
                        onChange={field.onChange}
                        min={0.1}
                        max={2.0}
                        step={0.01}
                      />
                    </FormControl>
                    <FormDescription>
                      Amplitude change per iteration.
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="u_harmonic_spread"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Harmonic Spread</FormLabel>
                    <FormControl>
                      <ExpressionInput
                        value={field.value}
                        onChange={field.onChange}
                        min={0.1}
                        max={10.0}
                        step={0.1}
                      />
                    </FormControl>
                    <FormDescription>
                      Frequency change per iteration.
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="u_amplitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amplitude</FormLabel>
                    <FormControl>
                      <ExpressionInput
                        value={field.value}
                        onChange={field.onChange}
                        min={0.0}
                        max={2.0}
                        step={0.01}
                      />
                    </FormControl>
                    <FormDescription>Overall noise amplitude.</FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="u_offset"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Offset</FormLabel>
                    <FormControl>
                      <ExpressionInput
                        value={field.value}
                        onChange={field.onChange}
                        min={0.0}
                        max={1.0}
                        step={0.01}
                      />
                    </FormControl>
                    <FormDescription>Noise offset value.</FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="u_exponent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exponent</FormLabel>
                    <FormControl>
                      <ExpressionInput
                        value={field.value}
                        onChange={field.onChange}
                        min={0.1}
                        max={3.0}
                        step={0.01}
                      />
                    </FormControl>
                    <FormDescription>
                      Controls detail distribution.
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timeExpression"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Expression</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., time * 0.1" />
                    </FormControl>
                    <FormDescription>
                      Expression for time animation.
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>

            {/* Transform Properties */}
            <Card>
              <CardHeader>
                <CardTitle>Transform</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="u_scale"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scale</FormLabel>
                      <FormControl>
                        <ExpressionVector2Input
                          value={field.value}
                          onChange={field.onChange}
                          min={-1000}
                          max={1000}
                          step={0.1}
                        />
                      </FormControl>
                      <FormDescription>Scale of the noise.</FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="u_translate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Translate</FormLabel>
                      <FormControl>
                        <ExpressionVector2Input
                          value={field.value}
                          onChange={field.onChange}
                          min={-1000}
                          max={1000}
                          step={0.1}
                        />
                      </FormControl>
                      <FormDescription>
                        Position offset of the noise.
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="u_rotation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rotation</FormLabel>
                      <FormControl>
                        <ExpressionVector2Input
                          value={field.value}
                          onChange={field.onChange}
                          min={-Math.PI}
                          max={Math.PI}
                          step={0.01}
                        />
                      </FormControl>
                      <FormDescription>
                        Rotation angles in radians.
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <Button type="submit">Save Changes</Button>
      </form>
    </Form>
  );
}
