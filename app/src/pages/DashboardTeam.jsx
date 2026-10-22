import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { db } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import EditRoleDialog from '@/components/team/EditRoleDialog'
import InviteMemberCard from '@/components/team/InviteMemberCard'
import MemberList from '@/components/team/MemberList'
import RemoveUserDialog from '@/components/team/RemoveUserDialog'
import SendMessageDialog from '@/components/team/SendMessageDialog'
import { sortUsersByRole } from '@/components/team/roles'

export default function DashboardTeam() {
  const { isSuperAdmin, user, profile } = useAuth()

  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('user')
  const [inviting, setInviting] = useState(false)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [removeUser, setRemoveUser] = useState(null)
  const [editUser, setEditUser] = useState(null)
  const [editRole, setEditRole] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [messageUser, setMessageUser] = useState(null)
  const [messageBody, setMessageBody] = useState('')
  const [sending, setSending] = useState(false)

  const loadMembers = useCallback(async () => {
    try {
      const data = await db.list('profiles', { order: 'created_date', asc: false })
      setMembers(data)
    } catch (error) {
      toast.error(error?.message || 'Failed to load members')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />

  const handleInvite = async (event) => {
    event.preventDefault()
    const target = email.trim().toLowerCase()
    if (!target) return
    if (members.some((member) => String(member.email || '').toLowerCase() === target)) {
      toast.error('البريد ده مسجل بالفعل — عدّل دوره من قائمة الأعضاء بدل ما تبعته دعوة جديدة')
      return
    }
    setInviting(true)
    try {
      const { error } = await supabase.functions.invoke('invite-user', {
        body: { email: target, role: inviteRole },
      })
      if (error) throw error
      toast.success(`Invited ${target} as ${inviteRole}`)
      setEmail('')
      loadMembers()
    } catch (error) {
      let raw = String(error?.message || error || '')
      try {
        if (error?.context && typeof error.context.json === 'function') {
          const body = await error.context.json()
          if (body?.error) raw = String(body.error)
        }
      } catch {
        void 0
      }
      if (raw === 'email_already_registered') {
        toast.error('البريد ده مسجل بالفعل — عدّل دوره من قائمة الأعضاء بدل ما تبعته دعوة جديدة')
      } else if (/function|not found|404|failed to send a request/i.test(raw)) {
        toast.error(
          'الدعوات بالبريد مش مفعّلة على السيرفر — ضيف المستخدم من لوحة Supabase وحدد دوره من هنا',
        )
      } else {
        toast.error(raw || 'Failed to invite user')
      }
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async () => {
    if (!removeUser) return
    try {
      await db.remove('profiles', removeUser.id)
      toast.success(`Removed ${removeUser.email}`)
      setRemoveUser(null)
      loadMembers()
    } catch (error) {
      toast.error(error?.message || 'Failed to remove user')
    }
  }

  const handleSaveRole = async () => {
    if (!editUser) return
    setSavingId(editUser.id)
    try {
      await db.update('profiles', editUser.id, { role: editRole })
      toast.success(`Updated ${editUser.email}`)
      setEditUser(null)
      setSavingId(null)
      loadMembers()
    } catch (error) {
      toast.error(error?.message || 'Failed to update role')
      setSavingId(null)
    }
  }

  const handleOpenEdit = (member) => {
    setEditUser(member)
    setEditRole(member.role || 'user')
  }

  const handleOpenMessage = (member) => {
    setMessageUser(member)
    setMessageBody('')
  }

  const handleSendMessage = async () => {
    if (!messageUser || !messageBody.trim()) return
    setSending(true)
    try {
      await db.create('messages', {
        to_email: messageUser.email,
        from_email: user?.email || '',
        from_name: profile?.full_name || user?.user_metadata?.full_name || 'Admin',
        subject: 'Message from Admin',
        body: messageBody,
        read: false,
      })
    } catch (error) {
      toast.error(error?.message || 'Failed to save message')
      setSending(false)
      return
    }
    let emailSent = true
    try {
      const { error: sendError } = await supabase.functions.invoke('send-email', {
        body: {
          to: messageUser.email,
          subject: 'New message from Dev Academy Admin',
          body: messageBody,
        },
      })
      if (sendError) emailSent = false
    } catch {
      emailSent = false
    }
    toast.success(
      emailSent
        ? `Message sent to ${messageUser.email}`
        : `✅ اتحفظت في إشعارات ${messageUser.email} — تنبيه البريد مش مفعّل حاليًا`,
    )
    setMessageUser(null)
    setMessageBody('')
    setSending(false)
  }

  const sortedMembers = sortUsersByRole(members)

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">
        Team Management
      </h1>

      <InviteMemberCard
        email={email}
        role={inviteRole}
        inviting={inviting}
        onEmailChange={setEmail}
        onRoleChange={setInviteRole}
        onSubmit={handleInvite}
      />

      <MemberList
        users={sortedMembers}
        loading={loading}
        currentUserEmail={user?.email}
        onEdit={handleOpenEdit}
        onMessage={handleOpenMessage}
        onRemove={setRemoveUser}
      />

      <EditRoleDialog
        user={editUser}
        role={editRole}
        savingId={savingId}
        onRoleChange={setEditRole}
        onSave={handleSaveRole}
        onClose={() => setEditUser(null)}
      />

      <SendMessageDialog
        user={messageUser}
        body={messageBody}
        sending={sending}
        onBodyChange={setMessageBody}
        onSend={handleSendMessage}
        onClose={() => setMessageUser(null)}
      />

      <RemoveUserDialog
        user={removeUser}
        onRemove={handleRemove}
        onClose={() => setRemoveUser(null)}
      />
    </div>
  )
}
