import React, { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Shield } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function GatePassVerify() {
  const [, params] = useRoute("/verify/gate-pass/:token");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.token) return;
    fetch(`${API_BASE}/gate-passes/verify/${params.token}`)
      .then((r) => r.json())
      .then(setResult)
      .catch(() => setResult({ valid: false, error: "Verification failed" }))
      .finally(() => setLoading(false));
  }, [params?.token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-muted-foreground">Verifying gate pass...</p>
      </div>
    );
  }

  const gp = result?.gatePass;
  const valid = result?.valid;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
        <div className={`px-6 py-4 flex items-center gap-3 ${valid ? "bg-emerald-600" : "bg-rose-600"} text-white`}>
          <Shield className="w-8 h-8" />
          <div>
            <p className="text-sm opacity-90">ASSETS TRACKER — Gate Verification</p>
            <p className="font-bold text-lg">{valid ? "VALID PASS" : "INVALID PASS"}</p>
          </div>
          {valid ? <CheckCircle2 className="w-8 h-8 ml-auto" /> : <XCircle className="w-8 h-8 ml-auto" />}
        </div>
        <div className="p-6 space-y-3">
          {result?.error && !valid && (
            <p className="text-rose-600 font-medium">{result.error}</p>
          )}
          {gp && (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Pass #</span><p className="font-medium">{gp.gate_pass_number}</p></div>
                <div><span className="text-muted-foreground">Status</span><p className="font-medium capitalize">{gp.status}</p></div>
                <div className="col-span-2"><span className="text-muted-foreground">Employee</span><p className="font-medium">{gp.employee_name} ({gp.employee_department})</p></div>
                <div className="col-span-2"><span className="text-muted-foreground">Asset</span><p className="font-medium">{gp.asset_name}{gp.serial_number ? ` — ${gp.serial_number}` : ""}</p></div>
                <div className="col-span-2"><span className="text-muted-foreground">Route</span><p className="font-medium">{gp.from_location} → {gp.to_location}</p></div>
                <div><span className="text-muted-foreground">Departure</span><p className="font-medium">{format(new Date(gp.departure_date), "MMM d, yyyy")}</p></div>
                {gp.expected_return_date && (
                  <div><span className="text-muted-foreground">Return by</span><p className="font-medium">{format(new Date(gp.expected_return_date), "MMM d, yyyy")}</p></div>
                )}
              </div>
              <p className="text-sm text-muted-foreground border-t pt-3">{gp.reason}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
