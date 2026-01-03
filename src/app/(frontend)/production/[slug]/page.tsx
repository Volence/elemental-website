import type { Metadata } from 'next'
import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import { SocialLinks } from '@/components/SocialLinks'
import { Mic, Eye, Video } from 'lucide-react'
import { isPopulatedPerson, getSocialLinksFromPerson } from '@/utilities/personHelpers'

// Skip static generation during build - pages will be generated on-demand
export const dynamic = 'force-dynamic'
export const dynamicParams = true

type Args = {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  // Skip database operations during build
  if (process.env.NEXT_BUILD_SKIP_DB) {
    return {
      title: 'Production Staff | Elemental (ELMT)',
    }
  }

  try {
    const { slug } = await paramsPromise
    const payload = await getPayload({ config: configPromise })

    const caster = await payload.find({
      collection: 'production',
      where: {
        slug: {
          equals: slug,
        },
      },
      limit: 1,
      depth: 1, // Populate person relationship
    })

    if (!caster.docs[0]) {
      return {
        title: 'Production Staff Not Found | Elemental (ELMT)',
      }
    }

    const casterData = caster.docs[0]
    
    // Get name from person relationship (required)
    const person = isPopulatedPerson(casterData.person) ? casterData.person : null
    const casterName = person?.name || 'Production Staff'

    const getTypeDescription = (type: string) => {
      const typeMap: Record<string, string> = {
        'caster': 'caster',
        'observer': 'observer',
        'producer': 'producer',
        'observer-producer': 'observer and producer',
        'observer-producer-caster': 'observer, producer, and caster',
      }
      return typeMap[type] || type
    }

    return {
      title: `${casterName} | Production Staff | Elemental (ELMT)`,
      description: `Learn more about ${casterName}, ${getTypeDescription(casterData.type)} for Elemental.`,
    }
  } catch (error) {
    // During build, database may not be available
    return {
      title: 'Production Staff | Elemental (ELMT)',
    }
  }
}

export default async function CasterPage({ params: paramsPromise }: Args) {
  try {
    const { slug } = await paramsPromise
    const payload = await getPayload({ config: configPromise })

    const caster = await payload.find({
      collection: 'production',
      where: {
        slug: {
          equals: slug,
        },
      },
      limit: 1,
      depth: 1, // Populate person relationship
    })

    if (!caster.docs[0]) {
      notFound()
    }

    const casterData = caster.docs[0]
    
    // Validate that person relationship exists (required field)
    if (!casterData.person) {
      console.error(`[Production Page] Production staff with slug "${slug}" has no person relationship`)
      notFound()
    }
    
    // Get name and bio from person relationship (required)
    const person = isPopulatedPerson(casterData.person) ? casterData.person : null
    
    if (!person) {
      console.error(`[Production Page] Person relationship for production staff "${slug}" is not populated (ID only)`)
      notFound()
    }
    
    const casterName = person.name || 'Production Staff'
    const bio = person.bio || undefined
  
  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      'caster': 'Caster',
      'observer': 'Observer',
      'producer': 'Producer',
      'observer-producer': 'Observer/Producer',
      'observer-producer-caster': 'Observer/Producer/Caster',
    }
    return typeMap[type] || type
  }

  const getTypeIcon = (type: string) => {
    if (type === 'observer') return Eye
    if (type === 'producer') return Video
    if (type === 'observer-producer' || type === 'observer-producer-caster') return Video
    return Mic // Default to Mic for caster
  }

  const typeLabel = getTypeLabel(casterData.type)
  const typeIcon = getTypeIcon(casterData.type)

  return (
    <div className="pt-24 pb-24 min-h-screen">
      <div className="container max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">{casterName}</h1>
          <div className="w-24 h-1 bg-primary mx-auto mb-6" />
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            {React.createElement(typeIcon, { className: 'w-5 h-5' })}
            <span className="text-lg">{typeLabel}</span>
          </div>
        </div>

        {/* Bio */}
        {bio && (
          <div className="mb-8 p-6 rounded-xl border border-border bg-card shadow-sm">
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{bio}</p>
          </div>
        )}

        {/* Social Links */}
        {(() => {
          // Social links are now only in the People collection
          const socialLinks = getSocialLinksFromPerson(person)
          
          const hasSocialLinks = socialLinks.twitter || socialLinks.twitch || socialLinks.youtube || socialLinks.instagram || socialLinks.tiktok || (socialLinks.customLinks && socialLinks.customLinks.length > 0) || (socialLinks.customLinks && socialLinks.customLinks.length > 0)
          
          if (!hasSocialLinks) return null
          
          return (
            <div className="mb-8 flex justify-center">
              <SocialLinks 
                links={socialLinks}
                showLabels={true}
              />
            </div>
          )
        })()}
      </div>
    </div>
  )
  } catch (error) {
    console.error('[Production Page] Error loading production staff:', error)
    // Return 404 if there's an error fetching the data
    notFound()
  }
}
