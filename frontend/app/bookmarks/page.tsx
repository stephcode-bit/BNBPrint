"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BookmarkX } from "lucide-react";
import { api } from "@/lib/api";
import { getUserId } from "@/lib/userId";
import TokenCard from "@/components/TokenCard";
import TokenCardSkeleton from "@/components/TokenCardSkeleton";

export default function BookmarksPage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["bookmarks", userId],
    queryFn: () => api.listBookmarks(userId as string),
    enabled: !!userId,
  });

  const tokens = (data || []).map((b) => b.token).filter((t): t is NonNullable<typeof t> => !!t);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">Your Watchlist</h1>
        <p className="text-sm text-bnb-muted mt-1">
          Bookmarked tokens, saved to this device. Everything here updates live as bonding progress and
          security scores change.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <TokenCardSkeleton key={i} />
          ))}
        </div>
      ) : tokens.length === 0 ? (
        <div className="rounded-xl border border-dashed border-bnb-border p-12 text-center">
          <BookmarkX className="mx-auto mb-3 text-bnb-muted" size={28} />
          <p className="text-sm text-bnb-muted">
            No bookmarks yet. Tap the bookmark icon on any token card to save it here for later review.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {tokens.map((token) => (
            <TokenCard key={token.address} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}
