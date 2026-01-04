'use client'

import React, { useState, useEffect } from 'react'

interface DiscordChannel {
  id: string
  name: string
  type: number
  position: number
  parentId?: string | null
}

interface DiscordCategory {
  id: string
  name: string
  position: number
  channels: DiscordChannel[]
}

interface ServerStructure {
  categories: DiscordCategory[]
  uncategorized: DiscordChannel[]
  roles: any[]
  memberCount: number
}

const DiscordServerManagerView = () => {
  const [structure, setStructure] = useState<ServerStructure | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'structure' | 'stats' | 'health'>('structure')

  useEffect(() => {
    loadServerStructure()
  }, [])

  const loadServerStructure = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/discord/server/structure')
      if (!response.ok) {
        throw new Error('Failed to load server structure')
      }
      const data = await response.json()
      setStructure(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="discord-server-manager">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading Discord server structure...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="discord-server-manager">
        <div className="error-state">
          <p className="error-message">Error: {error}</p>
          <button onClick={loadServerStructure} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="discord-server-manager">
      <div className="manager-header">
        <div className="server-info">
          {structure && (
            <span className="member-count">
              {structure.memberCount} members
            </span>
          )}
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'structure' ? 'active' : ''}`}
          onClick={() => setActiveTab('structure')}
        >
          Server Structure
        </button>
        <button
          className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Statistics
        </button>
        <button
          className={`tab ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          Health Check
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'structure' && structure && (
          <div className="server-structure">
            <div className="structure-header">
              <h3>Categories & Channels</h3>
              <button onClick={loadServerStructure} className="refresh-button">
                Refresh
              </button>
            </div>

            {structure.categories.map((category) => (
              <div key={category.id} className="category">
                <div className="category-header">
                  <h4>{category.name}</h4>
                  <span className="channel-count">{category.channels.length} channels</span>
                </div>
                <div className="channels-list">
                  {category.channels.map((channel) => (
                    <div key={channel.id} className="channel">
                      <span className="channel-icon">
                        {channel.type === 0 ? '#' : channel.type === 2 ? '🔊' : '📄'}
                      </span>
                      <span className="channel-name">{channel.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {structure.uncategorized.length > 0 && (
              <div className="category">
                <div className="category-header">
                  <h4>Uncategorized</h4>
                  <span className="channel-count">{structure.uncategorized.length} channels</span>
                </div>
                <div className="channels-list">
                  {structure.uncategorized.map((channel) => (
                    <div key={channel.id} className="channel">
                      <span className="channel-icon">
                        {channel.type === 0 ? '#' : channel.type === 2 ? '🔊' : '📄'}
                      </span>
                      <span className="channel-name">{channel.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="stats-view">
            <p>Statistics coming soon...</p>
          </div>
        )}

        {activeTab === 'health' && (
          <div className="health-view">
            <p>Health check coming soon...</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default DiscordServerManagerView
