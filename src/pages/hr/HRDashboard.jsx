import React, { useState } from "react";
import { useStore } from "../../store";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Users, FileText, Check, X, Send } from "lucide-react";

export const HRDashboard = () => {
  const { currentUser, requests, setRequests, employees } = useStore();
  const [selectedReq, setSelectedReq] = useState(null);
  const [comment, setComment] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const pendingRequests = requests.filter(r => r.status === "pending_hr");

  const handleForwardToICT = async (approved, req) => {
    if (!comment.trim()) return;
    
    setIsProcessing(true);
    
    try {
      if (approved) {
        // Forward to ICT
        const updatedRequest = {
          ...req,
          status: "pending_ict",
          timeline: [...req.timeline, {
            status: "forwarded_to_ict",
            timestamp: new Date().toISOString(),
            comment: comment,
            actor: currentUser.name,
            role: currentUser.role,
            action: "Forwarded to ICT",
            note: comment
          }],
          hrComment: comment,
          approvedBy: currentUser.name,
          approvedAt: new Date().toISOString()
        };
        
        setRequests(prev => prev.map(r => 
          r.id === req.id ? updatedRequest : r
        ));
      } else {
        // Reject request
        const updatedRequest = {
          ...req,
          status: "rejected",
          timeline: [...req.timeline, {
            status: "rejected_by_hr",
            timestamp: new Date().toISOString(),
            comment: comment,
            actor: currentUser.name,
            role: currentUser.role,
            action: "Rejected",
            note: comment
          }],
          hrComment: comment,
          rejectedBy: currentUser.name,
          rejectedAt: new Date().toISOString()
        };
        
        setRequests(prev => prev.map(r => 
          r.id === req.id ? updatedRequest : r
        ));
      }
      
      setComment("");
      setSelectedReq(null);
      
    } catch (error) {
      console.error("Error processing request:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetDialog = () => {
    setComment("");
    setSelectedReq(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light tracking-tight">HR Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage employee equipment requests and approvals
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending HR Approvals</CardTitle>
              <FileText className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-light text-black">{pendingRequests.length}</div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-light text-black">{employees.length}</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="border-b border-gray-100">
          <CardTitle className="text-base font-medium">Awaiting HR Approval</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pendingRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No requests waiting for HR approval.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="text-xs font-medium text-gray-500">Date</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500">Employee</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500">Department</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500">Items</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-500">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map(req => (
                  <TableRow key={req.id} className="border-b border-gray-100">
                    <TableCell className="text-sm text-gray-600">
                      {format(new Date(req.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{req.employeeName}</TableCell>
                    <TableCell className="text-sm text-gray-600">{req.department}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {req.items.map(i => `${i.qty}x ${i.name}`).join(", ")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-gray-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setSelectedReq({ ...req, action: 'reject' })}
                        >
                          <X className="w-4 h-4 mr-1" /> Reject
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-black text-white hover:bg-gray-800"
                          onClick={() => setSelectedReq({ ...req, action: 'approve' })}
                        >
                          <Send className="w-4 h-4 mr-1" /> Forward to ICT
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedReq} onOpenChange={(o) => !o && resetDialog()}>
        <DialogContent className="max-w-lg p-0 border-gray-200 shadow-xl">
          {selectedReq && (
            <>
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                <DialogHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <DialogTitle className="text-lg font-medium text-black">
                      {selectedReq.action === 'approve' ? 'Forward to ICT' : 'Reject Request'}
                    </DialogTitle>
                  </div>
                  <DialogDescription className="text-gray-500 text-sm">
                    <div className="flex items-center gap-3 mt-1">
                      <span>Request from: <span className="font-medium text-gray-900">{selectedReq.employeeName}</span></span>
                      <span className="text-gray-300">|</span>
                      <span>{format(new Date(selectedReq.createdAt), "PPP")}</span>
                    </div>
                  </DialogDescription>
                </DialogHeader>
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
                {/* Requested Items */}
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Requested Items
                  </h4>
                  <div className="space-y-2">
                    {selectedReq.items.map((item, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-medium text-gray-900">{item.qty}x {item.name}</span>
                        {item.specifications && (
                          <span className="text-gray-500 text-xs ml-2">({item.specifications})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Justification */}
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Justification
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {selectedReq.justification}
                  </p>
                </div>

                {/* Department Head Comment */}
                {selectedReq.headComment && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      Department Head Comment
                    </h4>
                    <div className="bg-gray-50 rounded-md p-3">
                      <p className="text-sm text-gray-600">{selectedReq.headComment}</p>
                      {selectedReq.approvedBy && (
                        <p className="text-xs text-gray-400 mt-2">
                          By: {selectedReq.approvedBy} on {format(new Date(selectedReq.approvedAt), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Comment Field */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Your Comment <span className="text-red-500">*</span>
                    <span className="text-gray-400 text-xs ml-1 font-normal">
                      (Required)
                    </span>
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all resize-none"
                    placeholder={selectedReq.action === 'approve' 
                      ? "Add comments explaining why this request is approved and ready for ICT..."
                      : "Add comments explaining why this request is being rejected..."
                    }
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows="3"
                  />
                  {!comment.trim() && (
                    <p className="text-xs text-gray-400 mt-1">
                      Please provide a comment to explain your decision
                    </p>
                  )}
                </div>

                {/* Timeline */}
                {selectedReq.timeline && selectedReq.timeline.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                      Timeline
                    </h4>
                    <div className="space-y-3">
                      {selectedReq.timeline.slice().reverse().map((entry, idx) => (
                        <div key={idx} className="relative pl-4 pb-3 border-l border-gray-200">
                          <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-gray-400"></div>
                          <div className="text-xs text-gray-500 mb-1">
                            {format(new Date(entry.timestamp), "MMM d, yyyy 'at' h:mm a")}
                          </div>
                          <div className="text-sm font-medium text-gray-900 capitalize mb-1">
                            {entry.status?.replace(/_/g, ' ') || entry.action || 'Updated'}
                            {entry.actor && (
                              <span className="text-gray-500 font-normal text-xs ml-2">
                                by {entry.actor}
                              </span>
                            )}
                          </div>
                          {entry.comment && (
                            <div className="text-sm text-gray-600 mt-1">{entry.comment}</div>
                          )}
                          {entry.note && !entry.comment && (
                            <div className="text-sm text-gray-600 mt-1">{entry.note}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30">
                <div className="flex gap-3">
                  <button
                    onClick={() => handleForwardToICT(selectedReq.action === 'approve', selectedReq)}
                    disabled={isProcessing || !comment.trim()}
                    className={`flex-1 px-4 py-2 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedReq.action === 'approve' 
                        ? 'bg-black hover:bg-gray-800' 
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {isProcessing ? "Processing..." : (selectedReq.action === 'approve' ? "Forward to ICT" : "Reject Request")}
                  </button>
                  <button
                    onClick={resetDialog}
                    disabled={isProcessing}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 hover:border-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                {!comment.trim() && (
                  <p className="text-xs text-gray-400 mt-3 text-center">
                    Please provide a comment before submitting your decision
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};