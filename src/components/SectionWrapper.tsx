'use client'

import React from 'react'

// Section wrapper component that adds data-section attribute for theming
export interface SectionWrapperProps {
  section: 'people' | 'teams' | 'production' | 'matches' | 'staff' | 'organization-staff' | 'system' | 'users' | 'recruitment' | 'tools'
  children: React.ReactNode
  className?: string
}

export const SectionWrapper: React.FC<SectionWrapperProps> = ({ section, children, className = '' }) => {
  return (
    <div data-section={section} className={className}>
      {children}
    </div>
  )
}

// Specific section wrappers for common collections
export const PeopleSection: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SectionWrapper section="people">{children}</SectionWrapper>
)

export const TeamsSection: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SectionWrapper section="teams">{children}</SectionWrapper>
)

export const ProductionSection: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SectionWrapper section="production">{children}</SectionWrapper>
)

export const MatchesSection: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SectionWrapper section="matches">{children}</SectionWrapper>
)

export const StaffSection: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SectionWrapper section="staff">{children}</SectionWrapper>
)

export const RecruitmentSection: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SectionWrapper section="recruitment">{children}</SectionWrapper>
)

export const SystemSection: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SectionWrapper section="system">{children}</SectionWrapper>
)







