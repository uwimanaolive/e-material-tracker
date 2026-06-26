import React from "react";
import QRCode from "react-qr-code";
import { format } from "date-fns";
import { Badge } from "./ui/badge";
import { FileText, MapPin, Calendar, User } from "lucide-react";

const verifyUrl = (passToken) => {
  const base = window.location.origin + (import.meta.env.BASE_URL || "").replace(/\/$/, "");
  return `${base}/verify/gate-pass/${passToken}`;
};

export const GatePassCard = ({ gatePass, compact = false }) => {
  if (!gatePass?.pass_token || gatePass.status !== "active") return null;

  const url = verifyUrl(gatePass.pass_token);

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 border rounded-lg bg-emerald-50/50 border-emerald-200">
        <div className="bg-white p-1.5 rounded border shrink-0">
          <QRCode value={url} size={64} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{gatePass.gate_pass_number}</p>
          <p className="text-xs text-muted-foreground truncate">{gatePass.asset_name}</p>
          <Badge variant="outline" className="mt-1 text-xs bg-emerald-100 text-emerald-800">Active — Show at gate</Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-emerald-500 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-50 to-white shadow-md max-w-sm">
      <div className="bg-emerald-600 text-white px-4 py-3 flex items-center gap-2">
        <FileText className="w-5 h-5" />
        <div>
          <p className="text-xs opacity-90">OFFICIAL GATE PASS</p>
          <p className="font-bold">{gatePass.gate_pass_number}</p>
        </div>
        <Badge className="ml-auto bg-white text-emerald-700">ACTIVE</Badge>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-lg border-2 border-emerald-200">
            <QRCode value={url} size={140} />
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">Scan at security gate for verification</p>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <span>{gatePass.employee_name}</span>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <span>{gatePass.asset_name}{gatePass.serial_number ? ` (${gatePass.serial_number})` : ""}</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <span>{gatePass.from_location} → {gatePass.to_location}</span>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <span>Departure: {format(new Date(gatePass.departure_date), "MMM d, yyyy")}
              {gatePass.expected_return_date && ` · Return: ${format(new Date(gatePass.expected_return_date), "MMM d, yyyy")}`}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground border-t pt-2">{gatePass.reason}</p>
      </div>
    </div>
  );
};
