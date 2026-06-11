import React from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useStore } from "../../store";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../../components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

const requestSchema = z.object({
  equipmentName: z.string().min(1, "Please select an equipment type"),
  qty: z.coerce.number().min(1, "Quantity must be at least 1"),
  justification: z.string().min(10, "Please provide a detailed justification (min 10 chars)"),
  urgency: z.enum(["Low", "Medium", "High"])
});

const URGENCY_OPTIONS = [
  {
    value: "Low",
    dot: "#9CA3AF",
    active: "bg-gray-100 border-gray-400 text-gray-700",
    inactive: "bg-white border-gray-200 text-gray-400 hover:bg-gray-50"
  },
  {
    value: "Medium",
    dot: "#D97706",
    active: "bg-amber-50 border-amber-500 text-amber-800",
    inactive: "bg-white border-gray-200 text-gray-400 hover:bg-amber-50"
  },
  {
    value: "High",
    dot: "#DC2626",
    active: "bg-red-50 border-red-500 text-red-800",
    inactive: "bg-white border-gray-200 text-gray-400 hover:bg-red-50"
  },
];

export const RequestForm = () => {
  const { currentUser, equipment, setRequests } = useStore();
  const [, setLocation] = useLocation();

  const form = useForm({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      equipmentName: "",
      qty: 1,
      justification: "",
      urgency: "Medium"
    }
  });

  const selectedUrgency = form.watch("urgency");

  const onSubmit = (data) => {
    const equip = equipment.find(e => e.name === data.equipmentName);
    const newRequest = {
      id: Date.now(),
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      department: currentUser.department,
      type: equip?.category || "Unknown",
      items: [{ name: data.equipmentName, qty: data.qty }],
      urgency: data.urgency,
      justification: data.justification,
      status: "pending_head",
      timeline: [{
        stage: "Request Submitted",
        actor: currentUser.name,
        action: "Submitted",
        timestamp: new Date().toISOString(),
        note: ""
      }],
      createdAt: new Date().toISOString()
    };
    setRequests(prev => [newRequest, ...prev]);
    alert("Request submitted — your equipment request has been sent for approval.");
    setLocation("/employee");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Header ── */}
      <motion.div
        className="flex items-center gap-4"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <Link
          href="/employee"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-700" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-950">
            Request Equipment
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Submit a new request for ICT equipment.
          </p>
        </div>
      </motion.div>

      {/* ── Form card ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.32, ease: "easeOut" }}
      >
        <Card className="border border-gray-200 shadow-none rounded-xl overflow-hidden">
          <CardHeader className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            <CardTitle className="text-sm font-bold tracking-tight text-gray-900">
              Equipment Details
            </CardTitle>
            <CardDescription className="text-xs text-gray-500 mt-0.5">
              Fill out the form below to request new hardware.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 py-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                {/* Equipment Type */}
                <FormField
                  control={form.control}
                  name="equipmentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-widest text-gray-400">
                        Equipment Type
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-10 rounded-lg border-gray-200 text-sm focus:ring-0 focus:border-gray-900">
                            <SelectValue placeholder="Choose an equipment type…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {equipment.map(e => (
                            <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                {/* Quantity + Urgency row */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="qty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-widest text-gray-400">
                          Quantity
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            className="h-10 rounded-lg border-gray-200 text-sm focus-visible:ring-0 focus-visible:border-gray-900"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="urgency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-widest text-gray-400">
                          Urgency
                        </FormLabel>
                        <div className="flex gap-1.5">
                          {URGENCY_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => field.onChange(opt.value)}
                              className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border-[1.5px] text-xs font-semibold transition-all ${
                                selectedUrgency === opt.value ? opt.active : opt.inactive
                              }`}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: opt.dot }}
                              />
                              {opt.value}
                            </button>
                          ))}
                        </div>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Justification */}
                <FormField
                  control={form.control}
                  name="justification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-widest text-gray-400">
                        Justification
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Explain why you need this equipment and how it will be used…"
                          className="min-h-[110px] rounded-lg border-gray-200 text-sm resize-none focus-visible:ring-0 focus-visible:border-gray-900 leading-relaxed"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                {/* Actions */}
                <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100">
                  <Link
                    href="/employee"
                    className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </Link>
                  <Button
                    type="submit"
                    className="h-9 px-4 rounded-lg bg-gray-950 text-white text-sm font-semibold hover:bg-gray-800 transition-colors inline-flex items-center gap-1.5"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    Submit Request
                  </Button>
                </div>

              </form>
            </Form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};