import React, { useState } from "react";
import { useStore } from "../../store";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/StatusBadge";
import { Timeline } from "../../components/Timeline";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { format } from "date-fns";

export const ReviewRequests = () => {
  const { currentUser, requests, updateRequest } = useStore();
  const [selectedReq, setSelectedReq] = useState(null);
  const [comment, setComment] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // For head, show all requests from their department
  const deptRequests = requests.filter(r => r.department === currentUser.department);

  const handleApproval = async (approved) => {
    if (!selectedReq) return;
    if (!comment.trim()) return; // Require comment for both approval and rejection
    
    setIsProcessing(true);
    
    try {
      const newStatus = approved ? "approved_by_head" : "rejected";
      const timelineEntry = {
        status: newStatus,
        timestamp: new Date().toISOString(),
        comment: comment,
        actor: currentUser.name,
        role: currentUser.role
      };
      
      const updatedRequest = {
        ...selectedReq,
        status: newStatus,
        timeline: [...selectedReq.timeline, timelineEntry],
        headComment: comment,
        approvedBy: approved ? currentUser.name : null,
        approvedAt: approved ? new Date().toISOString() : null
      };
      
      await updateRequest(selectedReq.id, updatedRequest);
      
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
        <h1 className="text-2xl font-light tracking-tight">Review Requests</h1>
        <p className="text-gray-500 text-sm mt-1">
          Review and manage equipment requests from your department
        </p>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="border-b border-gray-100">
          <CardTitle className="text-base font-medium">Department Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-xs font-medium text-gray-500">Date</TableHead>
                <TableHead className="text-xs font-medium text-gray-500">Employee</TableHead>
                <TableHead className="text-xs font-medium text-gray-500">Items</TableHead>
                <TableHead className="text-xs font-medium text-gray-500">Status</TableHead>
                <TableHead className="text-right text-xs font-medium text-gray-500">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deptRequests.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(req => (
                <TableRow key={req.id} className="border-b border-gray-100">
                  <TableCell className="text-sm text-gray-600">
                    {format(new Date(req.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{req.employeeName}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {req.items.map(i => `${i.qty}x ${i.name}`).join(", ")}
                  </TableCell>
                  <TableCell><StatusBadge status={req.status} /></TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedReq(req)}
                      disabled={req.status === "approved_by_head" || req.status === "rejected"}
                      className="text-gray-600 hover:text-black hover:bg-gray-100"
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedReq} onOpenChange={(o) => !o && resetDialog()}>
        <DialogContent className="max-w-lg p-0 border-gray-200 shadow-xl">
          {selectedReq && (
            <>
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                <DialogHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <DialogTitle className="text-lg font-medium text-black">
                      Review Request
                    </DialogTitle>
                    <StatusBadge status={selectedReq.status} />
                  </div>
                  <DialogDescription className="text-gray-500 text-sm">
                    <div className="flex items-center gap-3 mt-1">
                      <span>From: <span className="font-medium text-gray-900">{selectedReq.employeeName}</span></span>
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

                {/* Comment Field - Required for both actions */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Decision Comment <span className="text-red-500">*</span>
                    <span className="text-gray-400 text-xs ml-1 font-normal">
                      (Required for approval or rejection)
                    </span>
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all resize-none"
                    placeholder="Add your comments explaining the reason for your decision..."
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
                            {entry.status?.replace(/_/g, ' ')}
                            {entry.actor && (
                              <span className="text-gray-500 font-normal text-xs ml-2">
                                by {entry.actor}
                              </span>
                            )}
                          </div>
                          {entry.comment && (
                            <div className="text-sm text-gray-600 mt-1">{entry.comment}</div>
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
                    onClick={() => handleApproval(true)}
                    disabled={isProcessing || !comment.trim()}
                    className="flex-1 px-4 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? "Processing..." : "Approve & Forward"}
                  </button>
                  <button
                    onClick={() => handleApproval(false)}
                    disabled={isProcessing || !comment.trim()}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reject
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