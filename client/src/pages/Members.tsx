import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, apiUrl } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, User, ExternalLink, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Member {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  accountLink: string | null;
  screenshotFileId: string | null;
  status: string;
  balance: number;
  joinedAt: string;
  approvedAt: string | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "في انتظار", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  onboarding: { label: "في التسجيل", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  awaiting_info: { label: "ينتظر المعلومات", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  waiting_approval: { label: "ينتظر الموافقة", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  approved: { label: "مفعّل", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

function MemberCard({ member, showActions }: { member: Member; showActions?: boolean }) {
  const { toast } = useToast();

  const approveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/members/${member.telegramId}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "تم القبول", description: `تم قبول العضو ${member.firstName || member.username}` });
    },
    onError: () => toast({ title: "خطأ", description: "فشل قبول العضو", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/members/${member.telegramId}/reject`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "تم الرفض", description: `تم رفض العضو ${member.firstName || member.username}` });
    },
    onError: () => toast({ title: "خطأ", description: "فشل رفض العضو", variant: "destructive" }),
  });

  const cfg = statusConfig[member.status] || { label: member.status, color: "bg-gray-100 text-gray-800" };
  const displayName = [member.firstName, member.lastName].filter(Boolean).join(" ") || member.username || `#${member.telegramId}`;

  return (
    <Card data-testid={`card-member-${member.id}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate" data-testid={`text-member-name-${member.id}`}>{displayName}</div>
              {member.username && (
                <div className="text-sm text-muted-foreground">@{member.username}</div>
              )}
              <div className="text-xs text-muted-foreground mt-0.5">ID: {member.telegramId}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-1 rounded-md ${cfg.color}`}>{cfg.label}</span>
            {member.status === "approved" && (
              <span className="text-xs font-bold text-primary">{member.balance.toLocaleString()} دينار</span>
            )}
          </div>
        </div>

        {member.accountLink && (
          <div className="mt-3 flex items-center gap-2">
            <a
              href={member.accountLink.startsWith("http") ? member.accountLink : `https://instagram.com/${member.accountLink}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
              data-testid={`link-member-account-${member.id}`}
            >
              <ExternalLink className="w-3 h-3" />
              {member.accountLink}
            </a>
          </div>
        )}

        <div className="text-xs text-muted-foreground mt-2">
          انضم: {new Date(member.joinedAt).toLocaleDateString("ar-IQ")}
          {member.approvedAt && ` • تفعيل: ${new Date(member.approvedAt).toLocaleDateString("ar-IQ")}`}
        </div>

        {showActions && member.status === "waiting_approval" && (
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              className="bg-green-500 text-white flex-1"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              data-testid={`button-approve-${member.id}`}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              قبول
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
              data-testid={`button-reject-${member.id}`}
            >
              <XCircle className="w-4 h-4 mr-1" />
              رفض
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MemberList({ status }: { status?: string }) {
  const { data: members, isLoading } = useQuery<Member[]>({
    queryKey: ["/api/members", status],
    queryFn: () => fetch(apiUrl(`/api/members${status ? `?status=${status}` : ""}`), { credentials: "include" }).then(r => r.json()),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="pt-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!members?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>لا يوجد أعضاء في هذه الفئة</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {members.map(m => (
        <MemberCard key={m.id} member={m} showActions={status === "waiting_approval"} />
      ))}
    </div>
  );
}

export default function Members() {
  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">إدارة الأعضاء</h1>
        <p className="text-muted-foreground text-sm mt-1">عرض وإدارة جميع الأعضاء</p>
      </div>

      <Tabs defaultValue="waiting_approval">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="waiting_approval" data-testid="tab-waiting">ينتظر الموافقة</TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">المفعّلون</TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">الكل</TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">المرفوضون</TabsTrigger>
        </TabsList>

        <TabsContent value="waiting_approval" className="mt-4">
          <MemberList status="waiting_approval" />
        </TabsContent>
        <TabsContent value="approved" className="mt-4">
          <MemberList status="approved" />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <MemberList />
        </TabsContent>
        <TabsContent value="rejected" className="mt-4">
          <MemberList status="rejected" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
