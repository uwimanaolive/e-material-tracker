import React from "react";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { format } from "date-fns";

export const Timeline = ({ timeline }) => {
  if (!timeline || timeline.length === 0) return <div className="text-sm text-muted-foreground">No timeline events yet.</div>;

  return (
    <div className="relative border-l border-border ml-3 mt-4 space-y-6">
      {timeline.map((event, index) => (
        <div key={index} className="relative pl-6">
          <span className="absolute -left-[13px] top-1 bg-background">
            {event.action === "Approved" ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            ) : event.action === "Rejected" ? (
              <Circle className="w-6 h-6 text-rose-500 fill-rose-50" />
            ) : (
              <Clock className="w-6 h-6 text-blue-500" />
            )}
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-foreground">{event.stage}</span>
              <span className="text-xs text-muted-foreground">{format(new Date(event.timestamp), "MMM d, yyyy h:mm a")}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              <span className="font-medium text-foreground">{event.actor}</span> ({event.action})
            </div>
            {event.note && (
              <div className="mt-2 text-sm bg-muted/50 p-2 rounded-md border border-border">
                {event.note}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
