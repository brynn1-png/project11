"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, UserMinus, UserPlus, Warning } from "@phosphor-icons/react";
import { createStaffAccount, updateStaffAccount } from "@/app/staff/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_ROLES, formatRole, type AppRole } from "@/lib/auth/permissions";
import type { UserProfile } from "@/lib/types";

type AccountDraft = {
  profileId: string;
  fullName: string;
  role: AppRole;
  status: "active" | "inactive";
};

const emptyAccountForm = { fullName: "", email: "", password: "", role: "cashier" as AppRole };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="grid place-items-center px-5 py-12 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]"><Package size={23} /></span><h3 className="mt-4 font-bold">{title}</h3><p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">{text}</p></div>;
}

export function StaffAccountsView({
  users,
  usersError,
  currentUserId,
  canManage,
  notify,
}: {
  users: UserProfile[];
  usersError: string | null;
  currentUserId: string;
  canManage: boolean;
  notify: (message: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [accountError, setAccountError] = useState("");
  const [draft, setDraft] = useState<AccountDraft | null>(null);
  const [draftError, setDraftError] = useState("");

  const sorted = useMemo(
    () => [...users].sort((left, right) => Number(right.role === "administrator") - Number(left.role === "administrator") || left.fullName.localeCompare(right.fullName)),
    [users],
  );

  function startAdding() {
    setAdding(true);
    setAccountForm(emptyAccountForm);
    setAccountError("");
  }

  function addAccount(event: React.FormEvent) {
    event.preventDefault();
    setAccountError("");
    startTransition(async () => {
      const result = await createStaffAccount(accountForm);
      if (!result.ok) {
        setAccountError(result.message);
        return;
      }
      setAdding(false);
      setAccountForm(emptyAccountForm);
      notify(`${result.account.fullName} can now sign in as ${formatRole(result.account.role)}.`);
      router.refresh();
    });
  }

  function saveDraft() {
    if (!draft) return;
    setDraftError("");
    startTransition(async () => {
      const result = await updateStaffAccount({ profileId: draft.profileId, role: draft.role, status: draft.status });
      if (!result.ok) {
        setDraftError(result.message);
        return;
      }
      notify(`${draft.fullName} is now ${formatRole(draft.role)} and ${draft.status === "active" ? "active" : "inactive"}.`);
      setDraft(null);
      router.refresh();
    });
  }

  function cancelDraft() {
    setDraft(null);
    setDraftError("");
  }

  return <div className="grid gap-5">
    <section className="panel p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Staff Accounts</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Add an employee sign-in and control what each person can do. Every change is recorded in the audit log.</p>
        </div>
        {canManage && !adding && !usersError && <Button type="button" onClick={startAdding}><Plus data-icon="inline-start" />Add employee</Button>}
      </div>

      {usersError && <div role="alert" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">{usersError}</div>}

      {canManage && adding && (
        <form className="mt-5 grid gap-4 border-t border-[var(--border)] pt-5" onSubmit={addAccount}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="field-label" htmlFor="staff-full-name">Full name</label><Input id="staff-full-name" value={accountForm.fullName} onChange={(event) => setAccountForm((current) => ({ ...current, fullName: event.target.value }))} required minLength={2} maxLength={120} autoComplete="off" /></div>
            <div><label className="field-label" htmlFor="staff-email">Email address</label><Input id="staff-email" type="email" value={accountForm.email} onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))} required maxLength={320} autoComplete="off" /></div>
            <div><label className="field-label" htmlFor="staff-password">Starting password</label><Input id="staff-password" type="password" value={accountForm.password} onChange={(event) => setAccountForm((current) => ({ ...current, password: event.target.value }))} required minLength={8} maxLength={128} autoComplete="new-password" aria-describedby="staff-password-help" /><p id="staff-password-help" className="mt-1.5 text-xs text-[var(--muted-foreground)]">Share this with the employee in person. They can sign in immediately.</p></div>
            <div><label className="field-label" htmlFor="staff-role">Role</label><select id="staff-role" className="select-field" value={accountForm.role} onChange={(event) => setAccountForm((current) => ({ ...current, role: event.target.value as AppRole }))}>{APP_ROLES.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}</select></div>
          </div>
          {accountError && <Alert variant="destructive"><Warning aria-hidden="true" /><AlertTitle>Account not created</AlertTitle><AlertDescription>{accountError}</AlertDescription></Alert>}
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={isPending}>{isPending ? "Creating…" : "Create account"}</Button><Button type="button" variant="ghost" onClick={() => { setAdding(false); setAccountError(""); }}>Cancel</Button></div>
        </form>
      )}
    </section>

    <section className="panel overflow-hidden">
      {sorted.length > 0 ? <div className="overflow-x-auto">
        <table className="data-table min-w-[820px]">
          <thead><tr><th>User</th><th>Role</th><th>Status</th><th className="text-right">Access</th></tr></thead>
          <tbody>
            {sorted.map((user) => {
              const isSelf = user.id === currentUserId;
              const rowDraft = draft?.profileId === user.id ? draft : null;
              const draftRoleChanged = rowDraft ? rowDraft.role !== user.role : false;
              const draftStatusChanged = rowDraft ? rowDraft.status !== user.status : false;

              return <tr key={user.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#24483a] text-xs font-bold text-white">{initials(user.fullName)}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-semibold">{user.fullName}{isSelf && <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-[var(--accent-strong)]">You</span>}</span>
                      <span className="block truncate text-xs font-normal text-[var(--muted-foreground)]">{user.email}</span>
                    </span>
                  </div>
                </td>
                <td>
                  {canManage && !isSelf ? (
                    <select
                      className="select-field"
                      aria-label={`Role for ${user.fullName}`}
                      value={rowDraft && draftRoleChanged ? rowDraft.role : user.role}
                      disabled={isPending}
                      onChange={(event) => {
                        const role = event.target.value as AppRole;
                        setDraftError("");
                        setDraft({ profileId: user.id, fullName: user.fullName, role, status: user.status });
                      }}
                    >
                      {APP_ROLES.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}
                    </select>
                  ) : formatRole(user.role)}
                </td>
                <td>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${user.status === "active" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-[#52605a]"}`}>{user.status === "active" ? "Active" : "Inactive"}</span>
                </td>
                <td className="text-right">
                  {canManage && !isSelf && (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => {
                        setDraftError("");
                        setDraft({ profileId: user.id, fullName: user.fullName, role: user.role, status: user.status === "active" ? "inactive" : "active" });
                      }}
                    >
                      {user.status === "active" ? <><UserMinus data-icon="inline-start" />Deactivate</> : <><UserPlus data-icon="inline-start" />Reactivate</>}
                    </Button>
                  )}
                  {isSelf && <span className="text-xs text-[var(--muted-foreground)]">Your own account</span>}
                  {rowDraft && (draftRoleChanged || draftStatusChanged) && (
                    <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                      <span className="text-xs font-medium text-[var(--muted-foreground)]">Save changes?</span>
                      <Button type="button" disabled={isPending} onClick={saveDraft}>{isPending ? "Saving…" : "Save"}</Button>
                      <Button type="button" variant="ghost" disabled={isPending} onClick={cancelDraft}>Cancel</Button>
                    </div>
                  )}
                  {rowDraft && draftError && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{draftError}</p>}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div> : <EmptyState title={usersError ? "Staff accounts unavailable" : "No staff accounts found"} text={usersError ?? "Accounts appear here once an employee signs in for the first time, or after you add one."} />}
    </section>
  </div>;
}
