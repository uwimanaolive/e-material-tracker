import React from "react";
import { useStore } from "../../store";
import { assetsApi } from "../../api/assets";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Package, Monitor } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";

export const HeadStore = () => {
  const { currentUser } = useStore();
  const [store, setStore] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadStore();
  }, []);

  const loadStore = async () => {
    try {
      const data = await assetsApi.getStoreForDepartment(currentUser.department);
      setStore(data);
    } catch (error) {
      toast.error("Failed to load procurement store");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Procurement Store</h1>
        <p className="text-muted-foreground">
          Available items in store for {currentUser.department} department
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {store?.summary?.map((row) => (
          <Card key={row.category_id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{row.category_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{row.available_count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {row.reserved_for_department > 0
                  ? `${row.reserved_for_department} reserved for your dept`
                  : "General pool"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Available Items ({store?.items?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!store?.items?.length ? (
            <p className="text-muted-foreground text-center py-8">No items available in store for your department</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Brand / Model</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Pool</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {store.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.category_name}</TableCell>
                    <TableCell>{item.serial_number}</TableCell>
                    <TableCell>{[item.brand, item.model].filter(Boolean).join(" / ") || "—"}</TableCell>
                    <TableCell className="capitalize">{item.condition}</TableCell>
                    <TableCell>
                      <Badge variant={item.pool_type === "reserved" ? "default" : "secondary"}>
                        {item.pool_type === "reserved" ? currentUser.department : "General"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
