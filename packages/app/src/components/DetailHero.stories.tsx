import type { Meta, StoryObj } from "@storybook/react";
import { DetailHero } from "./DetailHero";

const meta: Meta<typeof DetailHero> = {
  title: "Organisms/DetailHero",
  component: DetailHero,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof DetailHero>;

const baseCreators = [
  { id: "c1", person: { id: "p1", name: "Lin-Manuel Miranda", slug: "lin-manuel-miranda" }, role: "Writer" },
  { id: "c2", person: { id: "p2", name: "Thomas Kail", slug: "thomas-kail" }, role: "Director" },
];

export const FullShow: Story = {
  args: {
    title: "Hamilton",
    description:
      "A dual biography of Alexander Hamilton and Aaron Burr that reframes the American Revolution through hip-hop, R&B, and traditional musical theater. The first act traces Hamilton's rise from orphan immigrant to revolutionary hero; the second dismantles it.",
    performanceTypes: ["Musical"],
    duration: 165,
    intermissions: 1,
    languages: ["English"],
    imageUrl: "https://picsum.photos/seed/detail-hamilton-bg/1400/500",
    posterUrl: "https://picsum.photos/seed/detail-hamilton-poster/280/420",
    creators: baseCreators,
    averageRating: 4.7,
    reviewCount: 128,
    totalAttendees: 3400,
    entityType: "Show",
    companyName: "The Public Theater",
    companySlug: "the-public-theater",
    venues: [{ name: "Richard Rodgers Theatre", slug: "richard-rodgers-theatre", city: "New York" }],
    startDate: "2015-08-06",
    endDate: "2026-12-31",
    ticketUrl: "https://example.com/tickets",
  },
};

export const SinglePerformance: Story = {
  args: {
    title: "Hamilton — Opening Night",
    description: null,
    performanceTypes: ["Musical"],
    duration: 165,
    intermissions: 1,
    languages: ["English"],
    imageUrl: "https://picsum.photos/seed/detail-hamilton-open/1400/500",
    posterUrl: "https://picsum.photos/seed/detail-hamilton-open-p/280/420",
    creators: baseCreators,
    averageRating: 4.9,
    reviewCount: 24,
    totalAttendees: 1400,
    entityType: "Performance",
    companyName: "The Public Theater",
    companySlug: "the-public-theater",
    venues: [{ name: "Richard Rodgers Theatre", slug: "richard-rodgers-theatre", city: "New York" }],
    performanceDate: "2026-04-20",
    performanceTime: "19:00",
    ticketUrl: "https://example.com/tickets",
  },
};

export const SoldOut: Story = {
  args: {
    title: "Macbeth",
    description: "Shakespeare's briefest and bloodiest tragedy, staged in the round.",
    performanceTypes: ["Drama"],
    duration: 145,
    intermissions: 1,
    languages: ["English"],
    creators: [{ id: "c3", person: { id: "p3", name: "Sam Gold", slug: "sam-gold" }, role: "Director" }],
    averageRating: 4.4,
    reviewCount: 84,
    totalAttendees: 800,
    entityType: "Performance",
    venues: [{ name: "Longacre Theatre", slug: "longacre-theatre", city: "New York" }],
    performanceDate: "2026-05-12",
    performanceTime: "20:00",
    soldOut: true,
  },
};

export const NoMedia: Story = {
  args: {
    title: "Untitled New Play",
    description: "A workshop reading — new material from a first-time playwright.",
    performanceTypes: ["Drama"],
    duration: 90,
    intermissions: 0,
    languages: null,
    averageRating: null,
    reviewCount: 0,
    totalAttendees: null,
    entityType: "Show",
    venues: [{ name: "Ars Nova", slug: "ars-nova", city: "New York" }],
  },
};

export const WithEdit: Story = {
  args: {
    title: "Hamilton",
    description: "The rare musical that lives up to its reputation.",
    performanceTypes: ["Musical"],
    duration: 165,
    intermissions: 1,
    languages: ["English"],
    creators: baseCreators,
    averageRating: 4.7,
    reviewCount: 128,
    totalAttendees: 3400,
    entityType: "Show",
    companyName: "The Public Theater",
    companySlug: "the-public-theater",
    venues: [{ name: "Richard Rodgers Theatre", slug: "richard-rodgers-theatre", city: "New York" }],
    startDate: "2015-08-06",
    endDate: "2026-12-31",
    onEdit: () => alert("Edit clicked"),
  },
};
