import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, Clock, Send, DollarSign, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  totalMembers: number;
  approvedMembers: number;
  pendingMembers: number;
  totalTasks: number;
  completedTasks: number;
  pendingPayments: number;
  totalPaid: number;
}

function StatCard({ title, value, icon: Icon, color, badge }: {
  title: string;
  value: number | string;
  icon: any;
  color: string;
  badge?: string;
}) {
  return (
    <Card className="relative">
      <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-md ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <div className="text-3xl font-bold" data-testid={`stat-${title}`}>{value}</div>
          {badge && <Badge variant="secondary" className="mb-1">{badge}</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<Stats>({ queryKey: ["/api/stats"] });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">لوحة التحكم</h1>
          <p className="text-muted-foreground text-sm mt-1">نظرة عامة على النظام</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">لوحة التحكم</h1>
          <p className="text-muted-foreground text-sm mt-1">نظرة عامة على منظومة التفاعل الرقمي</p>
        </div>
        <Badge variant="outline" className="text-primary border-primary">
          نظام نشط
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="إجمالي الأعضاء"
          value={stats?.totalMembers ?? 0}
          icon={Users}
          color="bg-blue-500"
        />
        <StatCard
          title="الأعضاء المفعلون"
          value={stats?.approvedMembers ?? 0}
          icon={CheckCircle}
          color="bg-green-500"
        />
        <StatCard
          title="طلبات الانتظار"
          value={stats?.pendingMembers ?? 0}
          icon={Clock}
          color="bg-orange-500"
          badge={stats?.pendingMembers ? "يحتاج مراجعة" : undefined}
        />
        <StatCard
          title="إجمالي المهام"
          value={stats?.totalTasks ?? 0}
          icon={Send}
          color="bg-purple-500"
        />
        <StatCard
          title="المهام المنجزة"
          value={stats?.completedTasks ?? 0}
          icon={TrendingUp}
          color="bg-teal-500"
        />
        <StatCard
          title="مدفوعات معلقة"
          value={stats?.pendingPayments ?? 0}
          icon={DollarSign}
          color="bg-red-500"
          badge={stats?.pendingPayments ? "يحتاج مراجعة" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">إجمالي المبالغ المدفوعة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary" data-testid="stat-total-paid">
              {(stats?.totalPaid ?? 0).toLocaleString()}
            </div>
            <p className="text-muted-foreground text-sm mt-1">دينار عراقي</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">معلومات البوت</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">رابط الموافقة</span>
              <a href="https://t.me/+C9Qk7j81KSdiODM6" target="_blank" rel="noopener noreferrer"
                className="text-sm text-primary hover:underline">فتح المجموعة</a>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">رابط المدفوعات</span>
              <a href="https://t.me/+wWAHO42c4wFiZTJi" target="_blank" rel="noopener noreferrer"
                className="text-sm text-primary hover:underline">فتح المجموعة</a>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">حالة البوت</span>
              <Badge className="bg-green-500 text-white">يعمل</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
