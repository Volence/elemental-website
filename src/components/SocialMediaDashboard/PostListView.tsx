'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import { formatLocalDateTime } from '@/utilities/formatDateTime'
import type { SocialPost, User } from '@/payload-types'

interface PostListViewProps {
  viewType: 'my-posts' | 'all-posts'
}

export function PostListView({ viewType }: PostListViewProps) {
  const { user } = useAuth()
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    status: 'all',
    postType: 'all',
  })

  useEffect(() => {
    fetchPosts()
  }, [viewType, user, filter])

  const fetchPosts = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const query: any = {}
      
      // Filter by user if "my-posts" view
      if (viewType === 'my-posts') {
        query.assignedTo = { equals: user.id }
      }
      
      // Apply status filter
      if (filter.status !== 'all') {
        query.status = { equals: filter.status }
      }
      
      // Apply post type filter
      if (filter.postType !== 'all') {
        query.postType = { equals: filter.postType }
      }

      const queryString = new URLSearchParams({
        where: JSON.stringify(query),
        sort: '-scheduledDate',
        limit: '50',
        depth: '1',
      }).toString()

      const response = await fetch(`/api/social-posts?${queryString}`)
      const data = await response.json()
      
      setPosts(data.docs || [])
    } catch (error) {
      console.error('Error fetching posts:', error)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeClass = (status: string) => {
    const statusClasses: Record<string, string> = {
      'Draft': 'status-badge--draft',
      'Ready for Review': 'status-badge--warning',
      'Approved': 'status-badge--success',
      'Scheduled': 'status-badge--info',
      'Posted': 'status-badge--complete',
    }
    return `status-badge ${statusClasses[status] || ''}`
  }

  const getPostTypeColor = (postType: string) => {
    const colors: Record<string, string> = {
      'Match Promo': '#3b82f6',
      'Stream Announcement': '#8b5cf6',
      'Community Engagement': '#10b981',
      'Original Content': '#f59e0b',
      'Repost/Share': '#6b7280',
      'Other': '#64748b',
    }
    return colors[postType] || '#64748b'
  }

  const isManager = user?.role === 'admin' || user?.role === 'staff-manager'

  if (loading) {
    return <div className="loading-spinner">Loading posts...</div>
  }

  return (
    <div className="post-list-view">
      <div className="post-list-view__header">
        <h2>{viewType === 'my-posts' ? 'My Posts' : 'All Posts'}</h2>
        <div className="post-list-view__actions">
          <Link href="/admin/collections/social-posts/create" className="btn btn--primary">
            + Create New Post
          </Link>
        </div>
      </div>

      <div className="post-list-view__filters">
        <select 
          value={filter.status} 
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="filter-select"
        >
          <option value="all">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Ready for Review">Ready for Review</option>
          <option value="Approved">Approved</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Posted">Posted</option>
        </select>

        <select 
          value={filter.postType} 
          onChange={(e) => setFilter({ ...filter, postType: e.target.value })}
          className="filter-select"
        >
          <option value="all">All Types</option>
          <option value="Match Promo">Match Promo</option>
          <option value="Stream Announcement">Stream Announcement</option>
          <option value="Community Engagement">Community Engagement</option>
          <option value="Original Content">Original Content</option>
          <option value="Repost/Share">Repost/Share</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {posts.length === 0 ? (
        <div className="post-list-view__empty">
          <p>No posts found. Create your first post to get started!</p>
        </div>
      ) : (
        <div className="post-list-view__table">
          <table>
            <thead>
              <tr>
                <th>Scheduled Date</th>
                <th>Content</th>
                <th>Type</th>
                <th>Platform</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const assignedUser = post.assignedTo as User
                return (
                  <tr key={post.id}>
                    <td>{post.scheduledDate ? formatLocalDateTime(post.scheduledDate) : 'Not scheduled'}</td>
                    <td className="post-content-cell">
                      <div className="post-content-preview">
                        {post.content ? (post.content.length > 80 
                          ? post.content.substring(0, 80) + '...' 
                          : post.content) : 'No content'}
                      </div>
                    </td>
                    <td>
                      <span 
                        className="post-type-badge"
                        style={{ 
                          backgroundColor: `${getPostTypeColor(post.postType)}20`,
                          color: getPostTypeColor(post.postType),
                          border: `1px solid ${getPostTypeColor(post.postType)}40`
                        }}
                      >
                        {post.postType}
                      </span>
                    </td>
                    <td>{post.platform}</td>
                    <td>
                      <span className={getStatusBadgeClass(post.status)}>
                        {post.status}
                      </span>
                    </td>
                    <td>{assignedUser?.name || 'Unassigned'}</td>
                    <td className="actions-cell">
                      <Link 
                        href={`/admin/collections/social-posts/${post.id}`}
                        className="btn btn--small btn--secondary"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewType === 'all-posts' && isManager && (
        <div className="post-list-view__pending-approval">
          <h3>Pending Approval</h3>
          {posts.filter(p => p.status === 'Ready for Review').length === 0 ? (
            <p>No posts waiting for approval</p>
          ) : (
            <div className="pending-approval-count">
              {posts.filter(p => p.status === 'Ready for Review').length} post(s) need your review
            </div>
          )}
        </div>
      )}
    </div>
  )
}

