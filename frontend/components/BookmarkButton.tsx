"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { getUserId } from "@/lib/userId";
import { addLocalBookmark, isBookmarkedLocally, removeLocalBookmark } from "@/lib/bookmarks";
import { useEffect, useState } from "react";

export default function BookmarkButton({ address, className }: { address: string; className?: string }) {
  const userId = typeof window !== "undefined" ? getUserId() : "server";
  const queryClient = useQueryClient();
  const [localState, setLocalState] = useState(false);

  useEffect(() => {
    setLocalState(isBookmarkedLocally(address));
  }, [address]);

  const { data: bookmarks } = useQuery({
    queryKey: ["bookmarks", userId],
    queryFn: () => api.listBookmarks(userId),
    enabled: userId !== "server",
    staleTime: 10_000,
  });

  const isBookmarked = bookmarks ? bookmarks.some((b) => b.token_address === address) : localState;

  const addMutation = useMutation({
    mutationFn: () => api.addBookmark(userId, address),
    onMutate: () => {
      addLocalBookmark(address);
      setLocalState(true);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["bookmarks", userId] }),
  });

  const removeMutation = useMutation({
    mutationFn: () => api.removeBookmark(userId, address),
    onMutate: () => {
      removeLocalBookmark(address);
      setLocalState(false);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["bookmarks", userId] }),
  });

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isBookmarked) removeMutation.mutate();
    else addMutation.mutate();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isBookmarked ? "Remove bookmark" : "Add to watchlist"}
      aria-pressed={isBookmarked}
      className={clsx(
        "inline-flex items-center justify-center rounded-md border min-w-[44px] min-h-[36px] w-9 h-9 transition-all",
        isBookmarked
          ? "border-bnb-yellow/50 bg-bnb-yellow/10 text-bnb-yellow"
          : "border-bnb-border bg-bnb-panel text-bnb-muted hover:text-bnb-yellow hover:border-bnb-yellow/40",
        className
      )}
    >
      <Bookmark size={15} fill={isBookmarked ? "currentColor" : "none"} />
    </button>
  );
}
