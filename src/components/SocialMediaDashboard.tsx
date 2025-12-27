'use client'

import React, { useState } from 'react'
import { CalendarView } from './SocialMediaDashboard/CalendarView'
import { WeeklyGoals } from './SocialMediaDashboard/WeeklyGoals'
import { TemplatesView } from './SocialMediaDashboard/TemplatesView'

export default function SocialMediaDashboard() {
  const [activeTab, setActiveTab] = useState('calendar')
  
  return (
    <div className="social-media-dashboard" data-section="social-media">
      <nav className="social-media-dashboard__tabs">
        <button 
          className={`social-media-dashboard__tab ${activeTab === 'calendar' ? 'social-media-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          📅 Calendar
        </button>
        
        <button 
          className={`social-media-dashboard__tab ${activeTab === 'goals' ? 'social-media-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('goals')}
        >
          🎯 Weekly Goals
        </button>
        
        <button 
          className={`social-media-dashboard__tab ${activeTab === 'templates' ? 'social-media-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          📄 Templates
        </button>
      </nav>
      
      <div className="social-media-dashboard__content">
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'goals' && <WeeklyGoals />}
        {activeTab === 'templates' && <TemplatesView />}
      </div>
    </div>
  )
}

