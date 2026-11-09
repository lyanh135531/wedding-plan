'use client';

import { useState, useEffect } from 'react';

/**
 * Hook tự động theo dõi chiều cao viewport và trạng thái mở modal/sheet
 * để ẩn thanh BottomNav di động khi cần thiết (đặc biệt khi bàn phím ảo xuất hiện
 * để tránh che khuất StickyActionBar hoặc form inputs).
 *
 * @param isModalOpen Trạng thái mở modal hoặc drawer toàn màn hình
 * @returns boolean `true` nếu thanh nav nên hiển thị, `false` nếu nên ẩn
 */
export function useNavVisibility(isModalOpen: boolean = false): boolean {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleViewportChange = () => {
      if (!window.visualViewport) return;
      // Nếu chiều cao visualViewport giảm hơn 25% so với window.innerHeight -> bàn phím ảo xuất hiện
      const heightRatio = window.visualViewport.height / window.innerHeight;
      setIsKeyboardVisible(heightRatio < 0.75);
    };

    const viewport = window.visualViewport;
    viewport.addEventListener('resize', handleViewportChange);
    viewport.addEventListener('scroll', handleViewportChange);

    // Kiểm tra lần đầu khi mount
    handleViewportChange();

    return () => {
      viewport.removeEventListener('resize', handleViewportChange);
      viewport.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  // Ẩn thanh BottomNav nếu đang mở Modal hoặc Bàn phím ảo đang xuất hiện
  const shouldHideNav = isModalOpen || isKeyboardVisible;
  return !shouldHideNav;
}
