import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, DollarSign, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TaskSubmission {
  id: number;
  taskId: number;
  memberId: string;
  workScreenshotFileId: string | null;
  accountScreenshotFileId: string | null;
  status: string;
  submittedAt: string;
  approvedAt: string | null;
}

interface Task {
  id: number;
  postLink: string;
  taskTypes: string[];
  price: number;
  assignedTo: string | null;
}

interface Member {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  balance: number;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "في الانتظار", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  approved: { label: "مدفوع", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  awaiting_work_screenshot: { label: "ينتظر سكرين العمل", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  awaiting_account_screenshot: { label: "ينتظر سكرين الحساب", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
};

function SubmissionCard({ submission, tasks, members }: {
  submission: TaskSubmission;
  tasks: Task[];
  members: Member[];
}) {
  const { toast } = useToast();
  const task = tasks.find(t => t.id === submission.taskId);
  const member = members.find(m => m.telegramId === submission.memberId);

  const approveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/submissions/${submission.id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "تم الدفع", description: `تم إضافة ${task?.price ?? 0} دينار لرصيد العضو` });
    },
    onError: () => toast({ title: "خطأ", description: "فشل إتمام الدفع", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/submissions/${submission.id}/reject`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      toast({ title: "تم الرفض", description: "تم رفض طلب الدفع" });
    },
    onError: () => toast({ title: "خطأ", description: "فشل رفض الطلب", variant: "destructive" }),
  });

  const cfg = statusConfig[submission.status] || { label: submission.status, color: "bg-gray-100 text-gray-800" };
  const memberName = member
    ? [member.firstName, member.username].filter(Boolean).join(" / ") || member.telegramId
    : submission.memberId;

  return (
    <Card data-testid={`card-submission-${submission.id}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${cfg.color}`}>{cfg.label}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(submission.submittedAt).toLocaleDateString("ar-IQ")}
              </span>
            </div>
            <div className="font-semibold mt-1" data-testid={`text-submission-member-${submission.id}`}>{memberName}</div>
            {task && (
              <>
                <a
                  href={task.postLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline block truncate mt-0.5"
                  dir="ltr"
                >
                  {task.postLink}
                </a>
                <div className="text-sm font-bold text-primary mt-1">
                  {task.price.toLocaleString()} دينار
                </div>
              </>
            )}
            {member && (
              <div className="text-xs text-muted-foreground mt-1">
                رصيد العضو الحالي: {member.balance.toLocaleString()} دينار
              </div>
            )}
          </div>
        </div>

        {submission.status === "pending" && (
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              className="bg-green-500 text-white flex-1"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              data-testid={`button-approve-payment-${submission.id}`}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              موافقة وإضافة الرصيد
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
              data-testid={`button-reject-payment-${submission.id}`}
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

function SubmissionList({ status, tasks, members }: { status?: string; tasks: Task[]; members: Member[] }) {
  const { data: submissions, isLoading } = useQuery<TaskSubmission[]>({
    queryKey: ["/api/submissions", status],
    queryFn: () => fetch(`/api/submissions${status ? `?status=${status}` : ""}`).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}><CardContent className="pt-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!submissions?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>لا يوجد طلبات في هذه الفئة</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {submissions.map(s => (
        <SubmissionCard key={s.id} submission={s} tasks={tasks} members={members} />
      ))}
    </div>
  );
}

export default function Payments() {
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["/api/members"],
    queryFn: () => fetch("/api/members").then(r => r.json()),
  });

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">المدفوعات</h1>
        <p className="text-muted-foreground text-sm mt-1">إدارة مدفوعات الأعضاء وأرصدتهم</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending-payments">في الانتظار</TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved-payments">المدفوعة</TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all-payments">الكل</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <SubmissionList status="pending" tasks={tasks} members={members} />
        </TabsContent>
        <TabsContent value="approved" className="mt-4">
          <SubmissionList status="approved" tasks={tasks} members={members} />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <SubmissionList tasks={tasks} members={members} />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">أرصدة الأعضاء</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members
              .filter(m => m.balance > 0)
              .sort((a, b) => b.balance - a.balance)
              .map(m => (
                <div key={m.telegramId} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm font-medium">
                    {m.firstName || m.username || m.telegramId}
                  </span>
                  <span className="text-sm font-bold text-primary" data-testid={`text-balance-${m.telegramId}`}>
                    {m.balance.toLocaleString()} دينار
                  </span>
                </div>
              ))}
            {members.filter(m => m.balance > 0).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">لا يوجد أرصدة بعد</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
