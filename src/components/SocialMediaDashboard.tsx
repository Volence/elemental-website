'use client'

import React, { useState } from 'react'
import { Calendar, LayoutList, Target, FileText, MessageSquare, Settings } from 'lucide-react'
import { CalendarView } from './SocialMediaDashboard/CalendarView'
import { WeeklyGoals } from './SocialMediaDashboard/WeeklyGoals'
import { TemplatesView } from './SocialMediaDashboard/TemplatesView'
import { SocialPostsTab } from './SocialMediaDashboard/SocialPostsTab'
import { KanbanBoard } from './WorkboardKanban'

export default function SocialMediaDashboard() {
  const [activeTab, setActiveTab] = useState('calendar')
  
  return (
    <div className="social-media-dashboard" data-section="social-media">
      <nav className="social-media-dashboard__tabs">
        <button 
          className={`social-media-dashboard__tab ${activeTab === 'calendar' ? 'social-media-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          <Calendar size={14} /> Calendar
        </button>
        
        <button 
          className={`social-media-dashboard__tab ${activeTab === 'workboard' ? 'social-media-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('workboard')}
        >
          <LayoutList size={14} /> Workboard
        </button>
        
        <button 
          className={`social-media-dashboard__tab ${activeTab === 'goals' ? 'social-media-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('goals')}
        >
          <Target size={14} /> Weekly Goals
        </button>
        
        <button 
          className={`social-media-dashboard__tab ${activeTab === 'templates' ? 'social-media-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <FileText size={14} /> Templates
        </button>

        <span className="social-media-dashboard__tab-divider" />

        <button 
          className={`social-media-dashboard__tab ${activeTab === 'posts' ? 'social-media-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          <MessageSquare size={14} /> Posts
        </button>

        <button 
          className={`social-media-dashboard__tab ${activeTab === 'settings' ? 'social-media-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={14} /> Settings
        </button>
      </nav>
      
      <div className="social-media-dashboard__content">
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'workboard' && <KanbanBoard department="social-media" title="Social Media Workboard" />}
        {activeTab === 'goals' && <WeeklyGoals />}
        {activeTab === 'templates' && <TemplatesView />}
        {activeTab === 'posts' && <SocialPostsTab />}
        {activeTab === 'settings' && (
          <div className="collection-list-tab" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1rem' }}>
              Configure templates, goals, and content guidelines for the social media department.
            </p>
            <a href="/admin/globals/social-media-config" className="collection-list-tab__btn collection-list-tab__btn--primary">
              <Settings size={14} /> <span>Open Social Media Settings</span>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
