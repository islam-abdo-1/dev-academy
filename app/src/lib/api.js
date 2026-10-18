import { supabase } from './supabase'

const withOrder = (q, order, asc) => (order ? q.order(order, { ascending: asc }) : q)

export async function list(table, { order = 'created_date', asc = true, limit } = {}) {
  let q = supabase.from(table).select('*')
  q = withOrder(q, order, asc)
  if (limit) q = q.limit(limit)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function filter(table, match = {}, { order, asc = true, limit } = {}) {
  let q = supabase.from(table).select('*')
  for (const [key, value] of Object.entries(match)) {
    if (Array.isArray(value)) q = q.in(key, value)
    else q = q.eq(key, value)
  }
  q = withOrder(q, order, asc)
  if (limit) q = q.limit(limit)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function get(table, id) {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function create(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single()
  if (error) throw error
  return data
}

export async function update(table, id, row) {
  const { data, error } = await supabase.from(table).update(row).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function remove(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
  return true
}

export const db = { list, filter, get, create, update, remove }
