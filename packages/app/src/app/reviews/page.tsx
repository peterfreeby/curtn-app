"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

interface Review {
  id: string;
  text: string;
  rating: number;
  createdAt: string;
  user: { fullName: string; username: string } | null;
  performance: { title: string } | null;
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReviews() {
      try {
        const token = localStorage.getItem("curtn_access_token");
        const res = await fetch("/api/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            query: `
              query {
                reviewList(first: 20) {
                  edges {
                    node {
                      id
                      text
                      rating
                      createdAt
                      user {
                        fullName
                        username
                      }
                      performance {
                        title
                      }
                    }
                  }
                }
              }
            `,
          }),
        });

        const json = await res.json();
        const edges = json.data?.reviewList?.edges || [];
        setReviews(edges.map((e: { node: Review }) => e.node));
      } catch (err) {
        console.error("Failed to fetch reviews:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchReviews();
  }, []);

  function renderStars(rating: number) {
    return "★".repeat(rating) + "☆".repeat(5 - rating);
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-12">
        <Link href="/">
          <h1 className="text-2xl font-bold tracking-tight">Curtn</h1>
        </Link>
        <p className="text-xs uppercase tracking-widest text-curtn-muted">
          Recent Reviews
        </p>
      </header>

      {loading ? (
        <div className="text-center text-curtn-muted py-20">Loading...</div>
      ) : reviews.length === 0 ? (
        <Card className="text-center py-16 space-y-4">
          <p className="text-curtn-muted">No reviews yet.</p>
          <p className="text-xs text-curtn-muted/60">
            Be the first to share what moved you.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id} className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">
                    {review.performance?.title || "Untitled Performance"}
                  </p>
                  <p className="text-xs text-curtn-muted">
                    {review.user?.fullName || "Anonymous"}
                    {review.user?.username && (
                      <span className="text-curtn-dark ml-1">
                        @{review.user.username}
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-curtn-coral text-sm tracking-wide">
                  {renderStars(review.rating)}
                </span>
              </div>
              {review.text && (
                <p className="text-sm text-curtn-cream/80 leading-relaxed">
                  {review.text}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
