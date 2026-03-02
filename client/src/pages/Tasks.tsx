import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, apiUrl } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Plus, Link, DollarSign, CheckSquare, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Member {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  status: string;
}

interface Task {
  id: number;
  postLink: string;
  assignedTo: string | null;
  taskTypes: string[];
  price: number;
  status: string;
  createdAt: string;
  sentAt: string | null;
}

const TASK_OPTIONS = [
  { id: "like", label: "لايك (Like)" },
  { id: "comment", label: "تعليق (Comment)" },
  { id: "share_story", label: "ستوري مع تاك (Share to Story)" },
  { id: "explore", label: "حركة الاكسبلور (Direct Share)" },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "في الانتظار", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  sent: { label: "مُرسلة", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  completed: { label: "مكتملة", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
};

function CreateTaskDialog({ members }: { members: Member[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [postLink, setPostLink] = useState("");
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [commentCount, setCommentCount] = useState("10");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [sendToAll, setSendToAll] = useState(false);
  const [price, setPrice] = useState("1000");
  const [notes, setNotes] = useState("");

  const approvedMembers = members.filter(m => m.status === "approved");

  const toggleMember = (telegramId: string) => {
    setSelectedMembers(prev =>
      prev.includes(telegramId) ? prev.filter(id => id !== telegramId) : [...prev, telegramId]
    );
  };

  const handleSendToAllChange = (checked: boolean) => {
    setSendToAll(checked);
    if (checked) setSelectedMembers([]);
  };

  const canSubmit = postLink && selectedTasks.length > 0 && (sendToAll || selectedMembers.length > 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      const taskTypesToSend = selectedTasks.map(t => {
        if (t === "comment" && commentCount) return `comment_${commentCount}`;
        return t;
      });

      if (sendToAll) {
        const res = await apiRequest("POST", "/api/tasks/send-all", {
          postLink,
          taskTypes: taskTypesToSend,
          price: parseInt(price),
          notes: notes || undefined,
        });
        return await res.json();
      } else {
        const res = await apiRequest("POST", "/api/tasks/send-selected", {
          postLink,
          taskTypes: taskTypesToSend,
          price: parseInt(price),
          notes: notes || undefined,
          telegramIds: selectedMembers,
        });
        return await res.json();
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      const desc = data.sentCount !== undefined
        ? `تم إرسال المهمة لـ ${data.sentCount} عضو من أصل ${data.total}`
        : "تم إنشاء وإرسال المهمة بنجاح";
      toast({ title: "تم إنشاء المهمة", description: desc });
      setOpen(false);
      setPostLink("");
      setSelectedTasks([]);
      setSelectedMembers([]);
      setSendToAll(false);
      setPrice("1000");
      setNotes("");
    },
    onError: () => toast({ title: "خطأ", description: "فشل إنشاء المهمة", variant: "destructive" }),
  });

  const toggleTask = (taskId: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskId) ? prev.filter(t => t !== taskId) : [...prev, taskId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-task">
          <Plus className="w-4 h-4 mr-2" />
          مهمة جديدة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>إنشاء مهمة جديدة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="post-link">رابط البوست</Label>
            <div className="relative">
              <Link className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="post-link"
                placeholder="https://instagram.com/p/..."
                value={postLink}
                onChange={e => setPostLink(e.target.value)}
                className="pr-9"
                data-testid="input-post-link"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>المهام المطلوبة</Label>
            <div className="border rounded-md p-3 space-y-3">
              {TASK_OPTIONS.map(opt => (
                <div key={opt.id} className="flex items-center gap-2">
                  <Checkbox
                    id={opt.id}
                    checked={selectedTasks.includes(opt.id)}
                    onCheckedChange={() => toggleTask(opt.id)}
                    data-testid={`checkbox-task-${opt.id}`}
                  />
                  <label htmlFor={opt.id} className="text-sm cursor-pointer">{opt.label}</label>
                  {opt.id === "comment" && selectedTasks.includes("comment") && (
                    <Input
                      type="number"
                      value={commentCount}
                      onChange={e => setCommentCount(e.target.value)}
                      className="w-20 h-7 text-sm"
                      placeholder="عدد"
                      data-testid="input-comment-count"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">السعر (دينار)</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={price === "500" ? "default" : "outline"}
                onClick={() => setPrice("500")}
                data-testid="button-price-500"
              >
                500 دينار
              </Button>
              <Button
                type="button"
                size="sm"
                variant={price === "1000" ? "default" : "outline"}
                onClick={() => setPrice("1000")}
                data-testid="button-price-1000"
              >
                1000 دينار
              </Button>
              <Input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="flex-1"
                data-testid="input-price"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظة (اختياري)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="اكتب ملاحظة للعضو..."
              data-testid="input-notes"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>إرسال إلى</Label>
              {!sendToAll && selectedMembers.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {selectedMembers.length} مختار
                </span>
              )}
            </div>
            <div className="border rounded-md p-3 space-y-2 max-h-44 overflow-y-auto">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  id="all-members"
                  checked={sendToAll}
                  onCheckedChange={(v) => handleSendToAllChange(!!v)}
                  data-testid="checkbox-all-members"
                />
                <label htmlFor="all-members" className="text-sm font-medium cursor-pointer">
                  جميع الأعضاء ({approvedMembers.length})
                </label>
              </div>
              {approvedMembers.map(m => (
                <div key={m.telegramId} className="flex items-center gap-2">
                  <Checkbox
                    id={`member-${m.telegramId}`}
                    checked={!sendToAll && selectedMembers.includes(m.telegramId)}
                    onCheckedChange={() => { setSendToAll(false); toggleMember(m.telegramId); }}
                    disabled={sendToAll}
                    data-testid={`checkbox-member-${m.telegramId}`}
                  />
                  <label
                    htmlFor={`member-${m.telegramId}`}
                    className={`text-sm cursor-pointer ${sendToAll ? "text-muted-foreground" : ""}`}
                  >
                    {m.firstName || m.username || m.telegramId}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            data-testid="button-submit-task"
          >
            <Send className="w-4 h-4 mr-2" />
            {createMutation.isPending ? "جاري الإرسال..." : "إنشاء وإرسال المهمة"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SendTaskDialog({ task, members }: { task: Task; members: Member[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const approvedMembers = members.filter(m => m.status === "approved");

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tasks/${task.id}/send`, { telegramId: selectedMember }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "تم الإرسال", description: "تم إرسال المهمة للعضو" });
      setOpen(false);
    },
    onError: () => toast({ title: "خطأ", description: "فشل إرسال المهمة", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid={`button-send-task-${task.id}`}>
          <Send className="w-3 h-3 mr-1" />
          إرسال
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>إرسال المهمة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <Select onValueChange={setSelectedMember} value={selectedMember}>
            <SelectTrigger>
              <SelectValue placeholder="اختر عضو..." />
            </SelectTrigger>
            <SelectContent>
              {approvedMembers.map(m => (
                <SelectItem key={m.telegramId} value={m.telegramId}>
                  {m.firstName || m.username || m.telegramId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="w-full"
            onClick={() => sendMutation.mutate()}
            disabled={!selectedMember || sendMutation.isPending}
          >
            إرسال
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteTaskButton({ taskId }: { taskId: number }) {
  const { toast } = useToast();
  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/tasks/${taskId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "تم الحذف", description: "تم حذف المهمة بنجاح" });
    },
    onError: () => toast({ title: "خطأ", description: "فشل حذف المهمة", variant: "destructive" }),
  });

  return (
    <Button
      size="sm"
      variant="destructive"
      onClick={() => deleteMutation.mutate()}
      disabled={deleteMutation.isPending}
      data-testid={`button-delete-task-${taskId}`}
    >
      <Trash2 className="w-3 h-3 mr-1" />
      حذف
    </Button>
  );
}

export default function Tasks() {
  const { data: tasks, isLoading: tasksLoading } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["/api/members"],
    queryFn: () => fetch(apiUrl("/api/members"), { credentials: "include" }).then(r => r.json()),
  });

  const TASK_LABELS: Record<string, string> = {
    like: "لايك",
    comment: "تعليق",
    share_story: "ستوري",
    explore: "اكسبلور",
  };

  if (tasksLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">المهام</h1>
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="pt-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">المهام</h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة وإرسال المهام للأعضاء</p>
        </div>
        <CreateTaskDialog members={members} />
      </div>

      {!tasks?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg">لا توجد مهام بعد</p>
          <p className="text-sm mt-1">أنشئ أول مهمة بالضغط على الزر أعلاه</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const cfg = statusConfig[task.status] || { label: task.status, color: "bg-gray-100 text-gray-800" };
            const assignedMember = members.find(m => m.telegramId === task.assignedTo);

            return (
              <Card key={task.id} data-testid={`card-task-${task.id}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(task.createdAt).toLocaleDateString("ar-IQ")}
                        </span>
                      </div>
                      <a
                        href={task.postLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline mt-1 block truncate"
                        data-testid={`link-task-post-${task.id}`}
                        dir="ltr"
                      >
                        {task.postLink}
                      </a>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {task.taskTypes.map(t => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {TASK_LABELS[t.split("_")[0]] || t}
                          </Badge>
                        ))}
                      </div>
                      {assignedMember && (
                        <div className="text-xs text-muted-foreground mt-1">
                          لـ: {assignedMember.firstName || assignedMember.username || assignedMember.telegramId}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-primary">{task.price.toLocaleString()} د</span>
                      {task.status === "pending" && (
                        <SendTaskDialog task={task} members={members} />
                      )}
                      <DeleteTaskButton taskId={task.id} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
