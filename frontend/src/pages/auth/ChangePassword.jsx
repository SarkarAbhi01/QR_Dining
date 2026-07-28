import { useState } from "react";
import api from "../../api/axios";
import StaffLayout from "../../components/layout/StaffLayout";

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await api.patch("/auth/change-password", { currentPassword, newPassword });
      setSuccess("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.response?.data?.message || "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <StaffLayout>
      <h1 className="font-display text-2xl mb-6">Change Password</h1>

      <form onSubmit={handleSubmit} className="card p-6 max-w-md space-y-4">
        {error && (
          <div className="bg-chili/10 border border-chili/30 text-chili text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-sage/10 border border-sage/30 text-sage text-sm rounded-lg px-3 py-2">
            {success}
          </div>
        )}

        <div>
          <label className="text-xs text-ash">Current Password</label>
          <input
            type="password"
            required
            className="input mt-1"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-ash">New Password</label>
          <input
            type="password"
            required
            minLength={6}
            className="input mt-1"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-ash">Confirm New Password</label>
          <input
            type="password"
            required
            minLength={6}
            className="input mt-1"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Updating…" : "Update Password"}
        </button>
      </form>
    </StaffLayout>
  );
}
