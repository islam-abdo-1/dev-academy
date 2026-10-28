import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { db } from '@/lib/api'
import { useAuth } from '@/lib/AuthContext'
import EditRoleDialog from '@/components/team/EditRoleDialog'
import InviteMemberCard from '@/components/team/InviteMemberCard'
import MemberList from '@/components/team/MemberList'
import RemoveUserDialog from '@/components/team/RemoveUserDialog'
import SendMessageDialog from '@/components/team/SendMessageDialog'
import { sortUsersByRole } from '@/components/team/roles'

export default function DashboardTeam() {
  const { isSuperAdmin, user, profile, refreshProfile } = useAuth()

  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('user')
  const [inviting, setInviting] = useState(false)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [removeUser, setRemoveUser] = useState(null)
  const [editUser, setEditUser] = useState(null)
  const [editRole, setEditRole] = useState('')
  const [editMajor, setEditMajor] = useState('')
  const [editYear, setEditYear] = useState('')
  const [editSemester, setEditSemester] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [messageUser, setMessageUser] = useState(null)
  const [messageBody, setMessageBody] = useState('')
  const [sending, setSending] = useState(false)
  const inviteRef = useRef(false)
  const messageRef = useRef(false)

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

  const handleInvite = (event) => {
    event.preventDefault()
    if (inviteRef.current) return
    const target = email.trim().toLowerCase()
    if (!target) return
    const existing = members.find(
      (member) => String(member.email || '').toLowerCase() === target,
    )
    if (!existing) {
      toast.error(
        'العضو لازم يسجّل الدخول بحساب Google الأول، وبعدها تقدر تحدد دوره من القائمة',
      )
      return
    }
    inviteRef.current = true
    setInviting(true)
    setEditUser(existing)
    setEditRole(inviteRole)
    setEditMajor(existing.major || '')
    setEditYear(existing.year || '')
    setEditSemester(existing.semester || '')
    setEmail('')
    setInviting(false)
    inviteRef.current = false
    toast.info('تم العثور على العضو — راجع الدور واحفظ التغيير')
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
      await db.update('profiles', editUser.id, {
        role: editRole,
        major: editMajor || null,
        year: editYear || null,
        semester: editSemester || null,
      })
      if (editUser.id === profile?.id) {
        await refreshProfile()
      }
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
    setEditMajor(member.major || '')
    setEditYear(member.year || '')
    setEditSemester(member.semester || '')
  }

  const handleOpenMessage = (member) => {
    setMessageUser(member)
    setMessageBody('')
  }

  const handleSendMessage = async () => {
    if (messageRef.current) return
    if (!messageUser || !messageBody.trim()) return
    messageRef.current = true
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
      messageRef.current = false
      setSending(false)
      return
    }
    toast.success(
      `✅ اتحفظت في إشعارات ${messageUser.email} — تنبيه البريد مش مفعّل حاليًا`,
    )
    setMessageUser(null)
    setMessageBody('')
    messageRef.current = false
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
        major={editMajor}
        year={editYear}
        semester={editSemester}
        savingId={savingId}
        onRoleChange={setEditRole}
        onTrackChange={(field, value) => {
          if (field === 'major') setEditMajor(value)
          else if (field === 'year') setEditYear(value)
          else if (field === 'semester') setEditSemester(value)
        }}
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
