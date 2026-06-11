import React, { useState } from "react";
import { useStore } from "../../store";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Plus } from "lucide-react";

export const Inventory = () => {
  const { equipment } = useStore();

  const getStockBadge = (status) => {
    switch(status) {
      case "available": return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">In Stock</Badge>;
      case "low_stock": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Low Stock</Badge>;
      case "out_of_stock": return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">Out of Stock</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Management</h1>
          <p className="text-muted-foreground">Manage ICT assets and stock levels.</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" /> Add Equipment
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Total Qty</TableHead>
                <TableHead className="text-right">In Use</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipment.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell className="text-right">{item.totalQty}</TableCell>
                  <TableCell className="text-right">{item.inUseQty}</TableCell>
                  <TableCell className="text-right font-medium">{item.availableQty}</TableCell>
                  <TableCell>{getStockBadge(item.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
