import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: 'right' | 'left';
}

const PortalMenu: React.FC<Props> = ({ anchorEl, open, onClose, children, align = 'right' }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open || !anchorEl) {
      setPos(null);
      return;
    }

    const update = () => {
      const rect = anchorEl.getBoundingClientRect();
      const menuWidth = 200; // approximate width used in pages
      const left = align === 'right' ? rect.right - menuWidth : rect.left;
      const top = rect.bottom + 8; // small gap
      setPos({ top, left });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorEl, open, align]);

  useEffect(() => {
    if (!open) return;
    const handleDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!anchorEl) return;
      if (anchorEl.contains(target)) return;
      // allow clicks inside portal children
      const portalRoot = document.getElementById('portal-menu-root');
      if (portalRoot && portalRoot.contains(target)) return;
      onClose();
    };
    document.addEventListener('click', handleDoc);
    return () => document.removeEventListener('click', handleDoc);
  }, [open, anchorEl, onClose]);

  if (!open || !pos) return null;

  const menu = (
    <div id="portal-menu-root" className="fixed left-0 top-0 z-[2000] pointer-events-none">
      <div
        style={{ position: 'fixed', top: pos.top, left: pos.left }}
        className="pointer-events-auto w-48 bg-white border border-gray-100 rounded-lg shadow-2xl py-2"
      >
        {children}
      </div>
    </div>
  );

  return createPortal(menu, document.body);
};

export default PortalMenu;
