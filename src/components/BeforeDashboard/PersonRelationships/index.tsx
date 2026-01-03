'use client'

import React from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'
import { usePersonRelationships } from '@/utilities/adminHooks'
import { formatRole, formatProductionType } from '@/utilities/formatters'

/**
 * Component that displays all teams and staff positions a person is associated with
 * Shows on the People edit page
 */
const PersonRelationships: React.FC = () => {
  const pathname = usePathname()
  const docInfo = useDocumentInfo()
  
  // Try multiple ways to get the ID
  const id = docInfo?.id || 
             (docInfo as any)?.document?.id || 
             (pathname?.match(/\/people\/(\d+)/)?.[1])
  
  const { relationships, loading } = usePersonRelationships(id)

  if (loading || !id) return null

  const totalRelationships = relationships.teams.length + relationships.orgStaff.length + relationships.production.length
  if (totalRelationships === 0) return null

  return (
    <div className="person-relationships">
      <div className="person-relationships__header">
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="person-relationships__icon"
        >
          <path
            d="M9 1.5C4.85786 1.5 1.5 4.85786 1.5 9C1.5 13.1421 4.85786 16.5 9 16.5C13.1421 16.5 16.5 13.1421 16.5 9C16.5 4.85786 13.1421 1.5 9 1.5ZM9 4.5C10.2426 4.5 11.25 5.50736 11.25 6.75C11.25 7.99264 10.2426 9 9 9C7.75736 9 6.75 7.99264 6.75 6.75C6.75 5.50736 7.75736 4.5 9 4.5ZM4.5 13.05C4.5 11.085 6.085 9.5 8.05 9.5H9.95C11.915 9.5 13.5 11.085 13.5 13.05V13.5H4.5V13.05Z"
            fill="var(--theme-text-600)"
          />
        </svg>
        <strong className="person-relationships__title">
          Associated Teams & Staff Positions
        </strong>
      </div>

      {relationships.teams.length > 0 && (
        <div className="person-relationships__section">
          <div className="person-relationships__section-title">
            Teams ({relationships.teams.length}):
          </div>
          <div className="person-relationships__list">
            {relationships.teams.map((team) => (
              <div key={team.id} className="person-relationships__item">
                <a
                  href={`/admin/collections/teams/${team.id}`}
                  className="person-relationships__link"
                >
                  {team.name}
                </a>
                <span className="person-relationships__roles">
                  ({team.roles.join(', ')})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {relationships.orgStaff.length > 0 && (
        <div className="person-relationships__section">
          <div className="person-relationships__section-title">
            Organization Staff ({relationships.orgStaff.length}):
          </div>
          <div className="person-relationships__staff-list">
            {relationships.orgStaff.map((staff) => (
              <div key={staff.id} className="person-relationships__staff-item">
                <a
                  href={`/admin/collections/organization-staff/${staff.id}`}
                  className="person-relationships__staff-link"
                >
                  Staff Entry #{staff.id}
                </a>
                <span className="person-relationships__roles">
                  ({staff.roles.map(formatRole).join(', ')})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {relationships.production.length > 0 && (
        <div className="person-relationships__section">
          <div className="person-relationships__section-title">
            Production Staff ({relationships.production.length}):
          </div>
          <div className="person-relationships__staff-list">
            {relationships.production.map((prod) => (
              <div key={prod.id} className="person-relationships__staff-item">
                <a
                  href={`/admin/collections/production/${prod.id}`}
                  className="person-relationships__staff-link"
                >
                  {formatProductionType(prod.type)}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default PersonRelationships
