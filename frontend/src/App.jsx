import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/common/ProtectedRoute";

import Login from "./pages/auth/Login";
import ChangePassword from "./pages/auth/ChangePassword";
import MenuPage from "./pages/customer/MenuPage";
import TrackOrderPage from "./pages/customer/TrackOrderPage";

import Dashboard from "./pages/admin/Dashboard";
import MenuManagement from "./pages/admin/MenuManagement";
import TableManagement from "./pages/admin/TableManagement";
import StaffManagement from "./pages/admin/StaffManagement";
import POSBilling from "./pages/admin/POSBilling";
import Reports from "./pages/admin/Reports";

import KitchenDisplay from "./pages/kitchen/KitchenDisplay";
import WaiterDashboard from "./pages/waiter/WaiterDashboard";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";

export default function App() {
  return (
    <Routes>
      {/* Public / customer-facing */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/menu/:qrToken" element={<MenuPage />} />
      <Route path="/track/:orderId" element={<TrackOrderPage />} />

      {/* Staff auth */}
      <Route path="/login" element={<Login />} />
      <Route
        path="/account/change-password"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN", "RESTAURANT_ADMIN", "MANAGER", "CHEF", "WAITER"]}>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      {/* Super Admin */}
      <Route
        path="/super-admin"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Restaurant Admin / Manager */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute roles={["RESTAURANT_ADMIN", "MANAGER", "SUPER_ADMIN"]}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/menu"
        element={
          <ProtectedRoute roles={["RESTAURANT_ADMIN", "MANAGER", "SUPER_ADMIN"]}>
            <MenuManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/tables"
        element={
          <ProtectedRoute roles={["RESTAURANT_ADMIN", "MANAGER", "SUPER_ADMIN"]}>
            <TableManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/staff"
        element={
          <ProtectedRoute roles={["RESTAURANT_ADMIN", "SUPER_ADMIN"]}>
            <StaffManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/pos"
        element={
          <ProtectedRoute roles={["RESTAURANT_ADMIN", "MANAGER", "SUPER_ADMIN"]}>
            <POSBilling />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute roles={["RESTAURANT_ADMIN", "MANAGER", "SUPER_ADMIN"]}>
            <Reports />
          </ProtectedRoute>
        }
      />

      {/* Kitchen */}
      <Route
        path="/kitchen"
        element={
          <ProtectedRoute roles={["CHEF", "RESTAURANT_ADMIN", "MANAGER"]}>
            <KitchenDisplay />
          </ProtectedRoute>
        }
      />

      {/* Waiter */}
      <Route
        path="/waiter"
        element={
          <ProtectedRoute roles={["WAITER", "RESTAURANT_ADMIN", "MANAGER"]}>
            <WaiterDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
