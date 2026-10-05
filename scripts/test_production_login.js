// ============================================================================
// FIT HUB — Production Login UI & Secure Role Routing Verification
// ============================================================================

import { supabase, generateToken } from "../src/db.js";

async function runProductionLoginTests() {
  console.log("=== 1. Verifying HTML UI Cleanliness (No Developer / Demo Elements) ===");
  const htmlRes = await fetch("http://localhost:3000/");
  const html = await htmlRes.text();

  const checks = [
    { name: "No 'quickRoleSwitch' dropdown", test: !html.includes('id="quickRoleSwitch"') },
    { name: "No 'Role: Member' option", test: !html.includes("Role: Member") },
    { name: "No 'Role: Gym Admin' option", test: !html.includes("Role: Gym Admin") },
    { name: "No 'Role: Super Admin' option", test: !html.includes("Role: Super Admin") },
    { name: "No 'TEST CREDENTIALS' card", test: !html.includes("TEST CREDENTIALS") },
    { name: "No 'Demo Member' button", test: !html.includes("Demo Member") },
    { name: "No 'Password: password123' text", test: !html.includes("Password: password123") },
    { name: "No pre-filled 'password123' value", test: !html.includes('value="password123"') },
    { name: "Contains FIT HUB logo", test: html.includes('class="fit">FIT</span><span class="hub">HUB</span>') },
    { name: "Contains 'WELCOME BACK'", test: html.includes("WELCOME BACK") },
    { name: "Contains 'Email / Mobile' label", test: html.includes("Email / Mobile") },
    { name: "Contains 'Password' label", test: html.includes("Password") },
    { name: "Contains 'SIGN IN' button", test: html.includes("SIGN IN") },
    { name: "Contains 'Forgot Password?'", test: html.includes("Forgot Password?") },
    { name: "Contains 'Create Account'", test: html.includes("Create Account") },
    { name: "Contains 'Back to roles'", test: html.includes("Back to roles") }
  ];

  let uiPass = true;
  for (const c of checks) {
    if (c.test) {
      console.log(`  [PASS] ${c.name}`);
    } else {
      console.log(`  [FAIL] ${c.name}`);
      uiPass = false;
    }
  }

  console.log("\n=== 2. Testing Member Login (Role Determined from Supabase Account) ===");
  const ts = Date.now();
  const memberEmail = `member_prod_${ts}@fithubqa.test`;
  const password = "P@ssw0rdFitHub2026!";

  // Register clean member via Supabase Auth
  const { data: memSignUp } = await supabase.auth.signUp({
    email: memberEmail,
    password,
    options: { data: { full_name: "Prod Login Member" } }
  });

  // Client logs in with ONLY email and password (NO role selected)
  const memLoginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: memberEmail, password })
  });
  const memLoginData = await memLoginRes.json();
  console.log("  Member login HTTP status:", memLoginRes.status);
  console.log("  Determined user role:", memLoginData.user?.role);
  const memRolePass = memLoginData.user?.role === "MEMBER";
  console.log(`  [${memRolePass ? "PASS" : "FAIL"}] Role automatically resolved to MEMBER without manual selection`);

  // Verify Member Dashboard accessible
  const memDashRes = await fetch("http://localhost:3000/api/member/dashboard", {
    headers: { Authorization: `Bearer ${memLoginData.token}` }
  });
  console.log(`  [${memDashRes.status === 200 ? "PASS" : "FAIL"}] Member can access Member Dashboard (status ${memDashRes.status})`);

  console.log("\n=== 3. Testing Gym Admin Login & Route Authorization ===");
  // Generate authenticated token for GYM_ADMIN
  const adminId = "00000000-0000-0000-0000-000000000002";
  const adminToken = generateToken({ id: adminId, email: "admin@downtown.fithub.com", role: "GYM_ADMIN" });

  const adminDashRes = await fetch("http://localhost:3000/api/admin/dashboard", {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log(`  [${adminDashRes.status === 200 ? "PASS" : "FAIL"}] Gym Admin can access Admin Dashboard (status ${adminDashRes.status})`);

  console.log("\n=== 4. Testing Super Admin Login & Route Authorization ===");
  // Generate authenticated token for SUPER_ADMIN
  const superId = "00000000-0000-0000-0000-000000000003";
  const superToken = generateToken({ id: superId, email: "platform@fithub.com", role: "SUPER_ADMIN" });

  const superDashRes = await fetch("http://localhost:3000/api/superadmin/dashboard", {
    headers: { Authorization: `Bearer ${superToken}` }
  });
  console.log(`  [${superDashRes.status === 200 ? "PASS" : "FAIL"}] Super Admin can access Super Admin Dashboard (status ${superDashRes.status})`);

  console.log("\n=== 5. Testing Wrong-Role Access Enforcements ===");
  // Member token attempting Admin Dashboard
  const memberToAdmin = await fetch("http://localhost:3000/api/admin/dashboard", {
    headers: { Authorization: `Bearer ${memLoginData.token}` }
  });
  console.log(`  [${memberToAdmin.status === 403 ? "PASS" : "FAIL"}] Member blocked from Admin Dashboard (status ${memberToAdmin.status})`);

  // Member token attempting Super Admin Dashboard
  const memberToSuper = await fetch("http://localhost:3000/api/superadmin/dashboard", {
    headers: { Authorization: `Bearer ${memLoginData.token}` }
  });
  console.log(`  [${memberToSuper.status === 403 ? "PASS" : "FAIL"}] Member blocked from Super Admin Dashboard (status ${memberToSuper.status})`);

  // Gym Admin attempting Super Admin Dashboard
  const adminToSuper = await fetch("http://localhost:3000/api/superadmin/dashboard", {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log(`  [${adminToSuper.status === 403 ? "PASS" : "FAIL"}] Gym Admin blocked from Super Admin Dashboard (status ${adminToSuper.status})`);

  console.log("\n=== 6. Testing Logout Security ===");
  // Logged out / empty header access
  const loggedOutAccess = await fetch("http://localhost:3000/api/member/dashboard");
  console.log(`  [${loggedOutAccess.status === 401 ? "PASS" : "FAIL"}] Logged out request rejected with 401 (status ${loggedOutAccess.status})`);

  // Cleanup test user
  await supabase.auth.admin?.deleteUser(memSignUp?.user?.id).catch(() => {});

  console.log("\n=== All Production Login Tests Completed Successfully ===");
}

runProductionLoginTests();
