import React from "react";
import { useStore } from "../../store";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { StatusBadge } from "../../components/StatusBadge";
import { format } from "date-fns";

export const HRReviewRequests = () => {
  const { requests } = useStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">All Requests</h1>
        <p className="text-muted-foreground">Global view of all equipment requests across the organization.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(req => (
                <TableRow key={req.id}>
                  <TableCell>{format(new Date(req.createdAt), "MMM d, yyyy")}</TableCell>
                  <TableCell className="font-medium">{req.employeeName}</TableCell>
                  <TableCell>{req.department}</TableCell>
                  <TableCell>{req.items.map(i => `${i.qty}x ${i.name}`).join(", ")}</TableCell>
                  <TableCell><StatusBadge status={req.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
