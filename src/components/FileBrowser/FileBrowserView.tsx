'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface FolderItem {
  id: number | string
  name: string
  fileCount?: number
  subfolderCount?: number
}

interface FileItem {
  id: number | string
  filename: string
  mimeType?: string
  url?: string
  thumbnailURL?: string
  sizes?: {
    thumbnail?: {
      url?: string
    }
  }
  updatedAt: string
  createdAt: string
}

interface Breadcrumb {
  id: number | string | null
  name: string
}

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  type: 'file' | 'folder' | 'background'
  targetId?: string | number
  targetName?: string
}

export function FileBrowserView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentFolderId = searchParams.get('folder') || null
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [folders, setFolders] = useState<FolderItem[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: 'Files' }])
  const [loading, setLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  
  // New Folder Modal
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)

  // Context Menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, type: 'background'
  })

  // Move Modal
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [availableFolders, setAvailableFolders] = useState<FolderItem[]>([])

  // Message/Confirm Modal (replaces native alert/confirm)
  const [messageModal, setMessageModal] = useState<{
    visible: boolean
    title: string
    message: string
    type: 'alert' | 'confirm'
    onConfirm?: () => void
  }>({ visible: false, title: '', message: '', type: 'alert' })

  // Helper functions for showing modals
  const showAlert = (message: string, title = 'Notice') => {
    setMessageModal({ visible: true, title, message, type: 'alert' })
  }

  const showConfirm = (message: string, onConfirm: () => void, title = 'Confirm') => {
    setMessageModal({ visible: true, title, message, type: 'confirm', onConfirm })
  }

  const closeMessageModal = () => {
    setMessageModal(prev => ({ ...prev, visible: false }))
  }

  // Marquee/Lasso Selection
  const gridRef = useRef<HTMLDivElement>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionBox, setSelectionBox] = useState<{
    startX: number
    startY: number
    currentX: number
    currentY: number
  } | null>(null)

  // Fetch folders and files for current location
  const fetchContents = useCallback(async () => {
    setLoading(true)
    setSelectedItems(new Set())

    try {
      // Fetch subfolders
      const folderQuery = currentFolderId 
        ? `?where[folder][equals]=${currentFolderId}&where[folderType][contains]=graphics-assets`
        : `?where[folder][exists]=false&where[folderType][contains]=graphics-assets`
      
      const foldersRes = await fetch(`/api/payload-folders${folderQuery}&limit=100`)
      const foldersData = await foldersRes.json()
      
      // Fetch files in current folder
      const fileQuery = currentFolderId
        ? `?where[folder][equals]=${currentFolderId}`
        : `?where[folder][exists]=false`
      
      const filesRes = await fetch(`/api/graphics-assets${fileQuery}&limit=100&sort=filename`)
      const filesData = await filesRes.json()

      setFolders(foldersData.docs || [])
      setFiles(filesData.docs || [])

      // Build breadcrumbs
      if (currentFolderId) {
        await fetchBreadcrumbs(currentFolderId)
      } else {
        setBreadcrumbs([{ id: null, name: 'Files' }])
      }
    } catch (error) {
      console.error('Error fetching file browser contents:', error)
    } finally {
      setLoading(false)
    }
  }, [currentFolderId])

  // Recursively build breadcrumb trail by traversing UP the tree
  const fetchBreadcrumbs = async (folderId: string) => {
    const trail: Breadcrumb[] = []
    let currentId: string | null = folderId

    // Walk up the tree from current folder to root
    while (currentId) {
      try {
        const res: Response = await fetch(`/api/payload-folders/${currentId}`)
        const folder: { id: string | number; name: string; folder?: { id?: string } | string | null } = await res.json()
        
        // Add this folder to the BEGINNING of trail (since we're walking up)
        trail.unshift({ id: folder.id, name: folder.name })
        
        const parentFolder = folder.folder
        currentId = typeof parentFolder === 'object' && parentFolder?.id 
          ? String(parentFolder.id) 
          : typeof parentFolder === 'string' 
            ? parentFolder 
            : null
      } catch {
        break
      }
    }
    
    // Add root at the beginning
    trail.unshift({ id: null, name: 'Files' })
    setBreadcrumbs(trail)
  }

  // Fetch all folders for move modal
  const fetchAllFolders = async () => {
    try {
      const res = await fetch('/api/payload-folders?where[folderType][contains]=graphics-assets&limit=500')
      const data = await res.json()
      setAvailableFolders(data.docs || [])
    } catch (error) {
      console.error('Error fetching folders:', error)
    }
  }

  useEffect(() => {
    fetchContents()
  }, [fetchContents])

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false }))
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Navigate into a folder
  const navigateToFolder = (folderId: number | string | null) => {
    if (folderId === null) {
      window.location.href = '/admin/collections/graphics-assets'
    } else {
      window.location.href = `/admin/collections/graphics-assets?folder=${folderId}`
    }
  }

  // Toggle item selection
  const toggleSelection = (id: string, type: 'folder' | 'file') => {
    const key = `${type}-${id}`
    const newSelection = new Set(selectedItems)
    if (newSelection.has(key)) {
      newSelection.delete(key)
    } else {
      newSelection.add(key)
    }
    setSelectedItems(newSelection)
  }

  // Select all visible items
  const selectAll = () => {
    const all = new Set<string>()
    folders.forEach(f => all.add(`folder-${f.id}`))
    files.forEach(f => all.add(`file-${f.id}`))
    setSelectedItems(all)
  }

  // Clear selection
  const clearSelection = () => setSelectedItems(new Set())

  // ==================== MARQUEE SELECTION ====================
  const containerRef = useRef<HTMLDivElement>(null)
  
  const handleMarqueeStart = (e: React.MouseEvent) => {
    // Only respond to left mouse button
    if (e.button !== 0) return
    // Don't start selection when clicking on header, toolbar, modals, context menu
    if ((e.target as HTMLElement).closest('.file-browser__header, .file-browser__toolbar, .file-browser__modal, .file-browser__context-menu, button, input')) return
    
    const container = e.currentTarget as HTMLElement
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left + container.scrollLeft
    const y = e.clientY - rect.top + container.scrollTop
    
    setIsSelecting(true)
    setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y })
    
    // Clear current selection unless shift is held
    if (!e.shiftKey) {
      setSelectedItems(new Set())
    }
  }

  const handleMarqueeMove = (e: React.MouseEvent) => {
    if (!isSelecting || !selectionBox) return
    
    const container = e.currentTarget as HTMLElement
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left + container.scrollLeft
    const y = e.clientY - rect.top + container.scrollTop
    
    setSelectionBox(prev => prev ? { ...prev, currentX: x, currentY: y } : null)
    
    // Calculate selection rectangle bounds
    const minX = Math.min(selectionBox.startX, x)
    const maxX = Math.max(selectionBox.startX, x)
    const minY = Math.min(selectionBox.startY, y)
    const maxY = Math.max(selectionBox.startY, y)
    
    // Find all items that intersect with selection box
    const newSelection = new Set<string>()
    const items = container.querySelectorAll('.file-browser__item')
    
    items.forEach((item) => {
      const itemRect = item.getBoundingClientRect()
      const itemX = itemRect.left - rect.left + container.scrollLeft
      const itemY = itemRect.top - rect.top + container.scrollTop
      const itemRight = itemX + itemRect.width
      const itemBottom = itemY + itemRect.height
      
      // Check if item intersects with selection box
      if (itemX < maxX && itemRight > minX && itemY < maxY && itemBottom > minY) {
        const itemKey = item.getAttribute('data-item-key')
        if (itemKey) newSelection.add(itemKey)
      }
    })
    
    setSelectedItems(newSelection)
  }

  const handleMarqueeEnd = () => {
    setIsSelecting(false)
    setSelectionBox(null)
  }

  // Get selection box style for rendering
  const getSelectionBoxStyle = () => {
    if (!selectionBox) return {}
    
    const left = Math.min(selectionBox.startX, selectionBox.currentX)
    const top = Math.min(selectionBox.startY, selectionBox.currentY)
    const width = Math.abs(selectionBox.currentX - selectionBox.startX)
    const height = Math.abs(selectionBox.currentY - selectionBox.startY)
    
    return { left, top, width, height }
  }

  // ==================== FILE UPLOAD ====================
  const uploadFiles = async (fileList: File[]) => {
    if (fileList.length === 0) return

    setUploading(true)
    setUploadProgress({ current: 0, total: fileList.length })

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      setUploadProgress({ current: i + 1, total: fileList.length })

      // Skip directories - multiple detection methods:
      // 1. Size 0 with no type (classic folder indicator)
      // 2. No file extension and size 0
      // 3. webkitRelativePath indicates it came from a folder
      const isLikelyFolder = (file.size === 0 && file.type === '') || 
                             (file.size === 0 && !file.name.includes('.'))
      
      if (isLikelyFolder) {
        console.warn(`Skipping directory or empty file: ${file.name}`)
        errorCount++
        continue
      }

      try {
        const formData = new FormData()
        formData.append('file', file)
        
        // Payload expects other fields to be sent as _payload JSON when uploading files
        if (currentFolderId) {
          formData.append('_payload', JSON.stringify({ folder: currentFolderId }))
        }

        const res = await fetch('/api/graphics-assets', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const errorText = await res.text()
          console.error(`Failed to upload ${file.name}:`, errorText)
          errorCount++
        } else {
          successCount++
        }
      } catch (error) {
        // This can happen with folder entries that slip through detection
        console.error(`Error uploading ${file.name}:`, error)
        errorCount++
      }
    }

    setUploading(false)
    setUploadProgress(null)
    
    // Show feedback
    if (errorCount > 0 && successCount === 0) {
      showAlert('Folders cannot be uploaded directly - please select individual files.', 'Upload Failed')
    } else if (errorCount > 0) {
      showAlert(`Uploaded ${successCount} file(s). ${errorCount} failed (folders are not supported).`, 'Upload Complete')
    }
    
    fetchContents() // Refresh the view
  }

  // Handle file drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    // Get items from dataTransfer
    const items = e.dataTransfer.items
    const droppedFiles: File[] = []
    let hasFolder = false
    
    // Check each item - if it's a directory, flag it
    if (items && items.length) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        // webkitGetAsEntry is the reliable way to detect folders
        const entry = item.webkitGetAsEntry?.()
        if (entry) {
          if (entry.isDirectory) {
            hasFolder = true
          } else if (entry.isFile) {
            const file = item.getAsFile()
            if (file) droppedFiles.push(file)
          }
        } else {
          // Fallback: just get the file
          const file = item.getAsFile()
          if (file) droppedFiles.push(file)
        }
      }
    } else {
      // Fallback to files array
      droppedFiles.push(...Array.from(e.dataTransfer.files))
    }
    
    // If a folder was detected, show message
    if (hasFolder && droppedFiles.length === 0) {
      showAlert('Cannot upload folders directly. Please select individual files inside the folder.', 'Folder Not Supported')
      return
    } else if (hasFolder) {
      showAlert(`Uploading ${droppedFiles.length} file(s). Folders are skipped.`, 'Note')
    }
    
    if (droppedFiles.length > 0) {
      await uploadFiles(droppedFiles)
    }
  }

  // Handle file input change
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      await uploadFiles(selectedFiles)
      e.target.value = '' // Reset input
    }
  }

  // ==================== FOLDER CREATION ====================
  const createFolder = async () => {
    if (!newFolderName.trim()) return

    setCreatingFolder(true)
    try {
      const body: Record<string, unknown> = {
        name: newFolderName.trim(),
        folderType: ['graphics-assets'],
      }
      if (currentFolderId) {
        body.folder = currentFolderId
      }

      const res = await fetch('/api/payload-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setShowNewFolderModal(false)
        setNewFolderName('')
        fetchContents()
      } else {
        console.error('Failed to create folder:', await res.text())
      }
    } catch (error) {
      console.error('Error creating folder:', error)
    } finally {
      setCreatingFolder(false)
    }
  }

  // ==================== DELETE ====================
  const deleteSelected = () => {
    const fileIds = Array.from(selectedItems).filter(s => s.startsWith('file-')).map(s => s.replace('file-', ''))
    const folderIds = Array.from(selectedItems).filter(s => s.startsWith('folder-')).map(s => s.replace('folder-', ''))

    const confirmMsg = `Delete ${fileIds.length} file(s) and ${folderIds.length} folder(s)?`
    
    showConfirm(confirmMsg, async () => {
      // Delete files
      for (const id of fileIds) {
        try {
          await fetch(`/api/graphics-assets/${id}`, { method: 'DELETE' })
        } catch (error) {
          console.error(`Error deleting file ${id}:`, error)
        }
      }

      // Delete folders
      for (const id of folderIds) {
        try {
          await fetch(`/api/payload-folders/${id}`, { method: 'DELETE' })
        } catch (error) {
          console.error(`Error deleting folder ${id}:`, error)
        }
      }

      clearSelection()
      fetchContents()
    }, 'Delete Items')
  }

  // ==================== MOVE ====================
  const moveSelectedToFolder = async (targetFolderId: string | null) => {
    const fileIds = Array.from(selectedItems).filter(s => s.startsWith('file-')).map(s => s.replace('file-', ''))
    const folderIds = Array.from(selectedItems).filter(s => s.startsWith('folder-')).map(s => s.replace('folder-', ''))

    // Move files
    for (const id of fileIds) {
      try {
        await fetch(`/api/graphics-assets/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: targetFolderId }),
        })
      } catch (error) {
        console.error(`Error moving file ${id}:`, error)
      }
    }

    // Move folders
    for (const id of folderIds) {
      try {
        await fetch(`/api/payload-folders/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: targetFolderId }),
        })
      } catch (error) {
        console.error(`Error moving folder ${id}:`, error)
      }
    }

    setShowMoveModal(false)
    clearSelection()
    fetchContents()
  }

  // ==================== DOWNLOAD ====================
  const downloadSelected = async () => {
    const fileIds = Array.from(selectedItems).filter(s => s.startsWith('file-')).map(s => s.replace('file-', ''))
    
    for (const id of fileIds) {
      const file = files.find(f => String(f.id) === id)
      if (file?.url) {
        const a = document.createElement('a')
        a.href = file.url
        a.download = file.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    }
  }

  // ==================== CONTEXT MENU ====================
  const handleContextMenu = (e: React.MouseEvent, type: 'file' | 'folder' | 'background', id?: string | number, name?: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      targetId: id,
      targetName: name,
    })
  }

  const handleContextAction = async (action: string) => {
    setContextMenu(prev => ({ ...prev, visible: false }))
    
    switch (action) {
      case 'open':
        if (contextMenu.type === 'folder' && contextMenu.targetId) {
          navigateToFolder(contextMenu.targetId)
        } else if (contextMenu.type === 'file' && contextMenu.targetId) {
          router.push(`/admin/collections/graphics-assets/${contextMenu.targetId}`)
        }
        break
      case 'download':
        if (contextMenu.type === 'file' && contextMenu.targetId) {
          const file = files.find(f => f.id === contextMenu.targetId)
          if (file?.url) {
            const a = document.createElement('a')
            a.href = file.url
            a.download = file.filename
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
          }
        }
        break
      case 'delete':
        if (contextMenu.targetId) {
          const targetKey = `${contextMenu.type}-${contextMenu.targetId}`
          
          // If this item is part of a selection, delete all selected items
          if (selectedItems.has(targetKey) && selectedItems.size > 1) {
            deleteSelected()
          } else {
            // Just delete this single item
            const endpoint = contextMenu.type === 'folder' ? 'payload-folders' : 'graphics-assets'
            const targetId = contextMenu.targetId
            showConfirm(`Delete "${contextMenu.targetName}"?`, async () => {
              await fetch(`/api/${endpoint}/${targetId}`, { method: 'DELETE' })
              fetchContents()
            }, 'Delete')
          }
        }
        break
      case 'move':
        if (contextMenu.targetId) {
          setSelectedItems(new Set([`${contextMenu.type}-${contextMenu.targetId}`]))
          await fetchAllFolders()
          setShowMoveModal(true)
        }
        break
      case 'new-folder':
        setShowNewFolderModal(true)
        break
      case 'upload':
        fileInputRef.current?.click()
        break
    }
  }

  // Get thumbnail for file
  const getThumbnail = (file: FileItem): string | null => {
    if (file.sizes?.thumbnail?.url) return file.sizes.thumbnail.url
    if (file.thumbnailURL) return file.thumbnailURL
    if (file.mimeType?.startsWith('image/') && file.url) return file.url
    return null
  }

  // Get icon for non-image files
  const getFileIcon = (mimeType?: string): string => {
    if (!mimeType) return '📄'
    if (mimeType.includes('pdf')) return '📕'
    if (mimeType.includes('photoshop') || mimeType.includes('psd')) return '🎨'
    if (mimeType.includes('illustrator') || mimeType.includes('postscript')) return '✏️'
    if (mimeType.includes('svg')) return '🖼️'
    return '📄'
  }

  if (loading) {
    return (
      <div className="file-browser file-browser--loading">
        <div className="file-browser__spinner">Loading...</div>
      </div>
    )
  }

  const hasSelection = selectedItems.size > 0

  return (
    <div 
      className={`file-browser ${isDragging ? 'file-browser--dragging' : ''} ${isSelecting ? 'file-browser--selecting' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onContextMenu={(e) => handleContextMenu(e, 'background')}
      onMouseDown={handleMarqueeStart}
      onMouseMove={handleMarqueeMove}
      onMouseUp={handleMarqueeEnd}
      onMouseLeave={handleMarqueeEnd}
    >
      {/* Selection box overlay - at container level for full area coverage */}
      {isSelecting && selectionBox && (
        <div 
          className="file-browser__selection-box"
          style={getSelectionBoxStyle()}
        />
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* Header with breadcrumbs */}
      <div className="file-browser__header">
        <div className="file-browser__breadcrumbs">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.id ?? 'root'}>
              {index > 0 && <span className="file-browser__breadcrumb-separator">/</span>}
              <button
                className={`file-browser__breadcrumb ${index === breadcrumbs.length - 1 ? 'file-browser__breadcrumb--active' : ''}`}
                onClick={() => navigateToFolder(crumb.id)}
                disabled={index === breadcrumbs.length - 1}
              >
                {index === 0 && <span className="file-browser__breadcrumb-icon">📁</span>}
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="file-browser__actions">
          <button 
            className="file-browser__btn file-browser__btn--primary"
            onClick={() => fileInputRef.current?.click()}
          >
            📤 Upload
          </button>
          <button 
            className="file-browser__btn file-browser__btn--secondary"
            onClick={() => setShowNewFolderModal(true)}
          >
            📁 New Folder
          </button>
        </div>
      </div>

      {/* Bulk actions toolbar */}
      {hasSelection && (
        <div className="file-browser__toolbar">
          <span className="file-browser__toolbar-count">{selectedItems.size} selected</span>
          <button onClick={downloadSelected} className="file-browser__toolbar-btn">📥 Download</button>
          <button onClick={async () => { await fetchAllFolders(); setShowMoveModal(true) }} className="file-browser__toolbar-btn">📂 Move</button>
          <button onClick={deleteSelected} className="file-browser__toolbar-btn file-browser__toolbar-btn--danger">🗑️ Delete</button>
          <button onClick={selectAll} className="file-browser__toolbar-btn">☑️ Select All</button>
          <button onClick={clearSelection} className="file-browser__toolbar-btn">✖️ Clear</button>
        </div>
      )}

      {/* Upload progress */}
      {uploading && uploadProgress && (
        <div className="file-browser__upload-progress">
          <div className="file-browser__upload-progress-bar">
            <div 
              className="file-browser__upload-progress-fill"
              style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
            />
          </div>
          <span>Uploading {uploadProgress.current} of {uploadProgress.total}...</span>
        </div>
      )}

      {/* Drop zone indicator */}
      {isDragging && (
        <div className="file-browser__drop-overlay">
          <div className="file-browser__drop-message">
            <span className="file-browser__drop-icon">📥</span>
            Drop files here to upload
          </div>
        </div>
      )}

      {/* Grid of folders and files */}
      <div 
        ref={gridRef}
        className={`file-browser__grid ${isSelecting ? 'file-browser__grid--selecting' : ''}`}
        onDragStart={(e) => e.preventDefault()}
      >

        {/* Folders first */}
        {folders.map((folder) => (
          <div
            key={`folder-${folder.id}`}
            data-item-key={`folder-${folder.id}`}
            className={`file-browser__item file-browser__item--folder ${selectedItems.has(`folder-${folder.id}`) ? 'file-browser__item--selected' : ''}`}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey) {
                toggleSelection(String(folder.id), 'folder')
              } else if (!isSelecting) {
                navigateToFolder(folder.id)
              }
            }}
            onDoubleClick={() => navigateToFolder(folder.id)}
            onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id, folder.name)}
            draggable={false}
          >
            <div className="file-browser__item-icon">📁</div>
            <div className="file-browser__item-name">{folder.name}</div>
          </div>
        ))}

        {/* Then files */}
        {files.map((file) => {
          const thumbnail = getThumbnail(file)
          return (
            <div
              key={`file-${file.id}`}
              data-item-key={`file-${file.id}`}
              className={`file-browser__item file-browser__item--file ${selectedItems.has(`file-${file.id}`) ? 'file-browser__item--selected' : ''}`}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  toggleSelection(String(file.id), 'file')
                } else if (!isSelecting) {
                  window.location.href = `/admin/collections/graphics-assets/${file.id}`
                }
              }}
              onContextMenu={(e) => handleContextMenu(e, 'file', file.id, file.filename)}
              draggable={false}
            >
              <div className="file-browser__item-preview">
                {thumbnail ? (
                  <img src={thumbnail} alt={file.filename} />
                ) : (
                  <span className="file-browser__item-icon file-browser__item-icon--large">
                    {getFileIcon(file.mimeType)}
                  </span>
                )}
              </div>
              <div className="file-browser__item-name" title={file.filename}>
                {file.filename}
              </div>
            </div>
          )
        })}

        {/* Empty state */}
        {folders.length === 0 && files.length === 0 && (
          <div className="file-browser__empty">
            <div className="file-browser__empty-icon">📂</div>
            <div className="file-browser__empty-text">This folder is empty</div>
            <div className="file-browser__empty-hint">
              Drag and drop files here, or click "Upload" to add assets
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div 
          className="file-browser__context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.type === 'folder' && (
            <>
              <button onClick={() => handleContextAction('open')}>📂 Open</button>
              <button onClick={() => handleContextAction('move')}>📁 Move to...</button>
              <button onClick={() => handleContextAction('delete')} className="danger">🗑️ Delete</button>
            </>
          )}
          {contextMenu.type === 'file' && (
            <>
              <button onClick={() => handleContextAction('open')}>📄 Open</button>
              <button onClick={() => handleContextAction('download')}>📥 Download</button>
              <button onClick={() => handleContextAction('move')}>📁 Move to...</button>
              <button onClick={() => handleContextAction('delete')} className="danger">🗑️ Delete</button>
            </>
          )}
          {contextMenu.type === 'background' && (
            <>
              {selectedItems.size > 0 && (
                <>
                  <button onClick={() => { downloadSelected(); setContextMenu(prev => ({ ...prev, visible: false })) }}>📥 Download Selected ({selectedItems.size})</button>
                  <button onClick={async () => { await fetchAllFolders(); setShowMoveModal(true); setContextMenu(prev => ({ ...prev, visible: false })) }}>📁 Move Selected</button>
                  <button onClick={() => { deleteSelected(); setContextMenu(prev => ({ ...prev, visible: false })) }} className="danger">🗑️ Delete Selected</button>
                  <hr className="file-browser__context-divider" />
                </>
              )}
              <button onClick={() => handleContextAction('upload')}>📤 Upload Files</button>
              <button onClick={() => handleContextAction('new-folder')}>📁 New Folder</button>
            </>
          )}
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="file-browser__modal-overlay" onClick={() => setShowNewFolderModal(false)}>
          <div className="file-browser__modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Folder</h3>
            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createFolder()}
              autoFocus
            />
            <div className="file-browser__modal-actions">
              <button onClick={() => setShowNewFolderModal(false)}>Cancel</button>
              <button onClick={createFolder} disabled={creatingFolder || !newFolderName.trim()}>
                {creatingFolder ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {showMoveModal && (
        <div className="file-browser__modal-overlay" onClick={() => setShowMoveModal(false)}>
          <div className="file-browser__modal" onClick={(e) => e.stopPropagation()}>
            <h3>Move to Folder</h3>
            <div className="file-browser__folder-list">
              <button 
                className="file-browser__folder-option"
                onClick={() => moveSelectedToFolder(null)}
              >
                📁 Root (no folder)
              </button>
              {availableFolders.map((folder) => (
                <button
                  key={folder.id}
                  className="file-browser__folder-option"
                  onClick={() => moveSelectedToFolder(String(folder.id))}
                >
                  📁 {folder.name}
                </button>
              ))}
            </div>
            <div className="file-browser__modal-actions">
              <button onClick={() => setShowMoveModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Message/Confirm Modal */}
      {messageModal.visible && (
        <div className="file-browser__modal-overlay" onClick={closeMessageModal}>
          <div className="file-browser__modal file-browser__modal--message" onClick={(e) => e.stopPropagation()}>
            <h3>{messageModal.title}</h3>
            <p className="file-browser__modal-message">{messageModal.message}</p>
            <div className="file-browser__modal-actions">
              {messageModal.type === 'confirm' ? (
                <>
                  <button onClick={closeMessageModal}>Cancel</button>
                  <button 
                    className="file-browser__modal-btn--danger"
                    onClick={() => {
                      closeMessageModal()
                      messageModal.onConfirm?.()
                    }}
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <button onClick={closeMessageModal}>OK</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FileBrowserView
