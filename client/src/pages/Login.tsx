import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Bot } from "lucide-react";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        credentials: "include",
      });

      if (res.ok) {
        onLogin();
      } else {
        setError("رمز الدخول غير صحيح");
      }
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
      <Card className="w-full max-w-sm mx-4" data-testid="card-login">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
            <Bot className="w-7 h-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">منظومة التفاعل</CardTitle>
          <p className="text-sm text-muted-foreground">أدخل رمز الدخول للمتابعة</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="رمز الدخول"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="pr-10"
                data-testid="input-access-code"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive text-center" data-testid="text-error">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading || !code} data-testid="button-login">
              {loading ? "جاري الدخول..." : "دخول"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
