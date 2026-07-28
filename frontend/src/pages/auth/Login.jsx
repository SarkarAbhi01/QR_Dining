import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const ROLE_HOME = {
  SUPER_ADMIN: "/super-admin",
  RESTAURANT_ADMIN: "/admin/dashboard",
  MANAGER: "/admin/dashboard",
  CHEF: "/kitchen",
  WAITER: "/waiter",
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(ROLE_HOME[user.role] || "/login");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-marigold">QR Dining</h1>
          <p className="text-ash text-sm mt-2">Staff sign-in — Admin, Manager, Chef & Waiter</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="bg-chili/10 border border-chili/30 text-chili text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="text-xs text-ash">Email</label>
            <input
              type="email"
              required
              className="input mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@spicejunction.com"
            />
          </div>
          <div>
            <label className="text-xs text-ash">Password</label>
            <input
              type="password"
              required
              className="input mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
