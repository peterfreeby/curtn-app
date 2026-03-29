import { connectToDatabase } from "../../../server/src/db/mongoose";
import { fromGlobalId } from "graphql-relay";

// Lightweight server-side data fetchers for generateMetadata

function decodeId(globalId: string): string {
  try {
    return fromGlobalId(globalId).id;
  } catch {
    // If it's already a MongoDB ObjectId, return as-is
    return globalId;
  }
}

export async function getShowMetadata(id: string) {
  await connectToDatabase();
  const { ShowModel } = require("../../../server/src/entities/show/showModel");
  const show = await ShowModel.findById(decodeId(id)).lean();
  if (!show) return null;
  return {
    title: show.title,
    description: show.description || `${show.title} on Curtn`,
    posterUrl: show.posterUrl || show.imageUrl || null,
    performanceTypes: show.performanceTypes || [],
  };
}

export async function getRunMetadata(id: string) {
  await connectToDatabase();
  const { RunModel } = require("../../../server/src/entities/run/runModel");
  const { ShowModel } = require("../../../server/src/entities/show/showModel");
  const { ProductionCompanyModel } = require("../../../server/src/entities/productionCompany/productionCompanyModel");
  const { VenueModel } = require("../../../server/src/entities/venue/venueModel");

  const run = await RunModel.findById(decodeId(id)).lean();
  if (!run) return null;

  const show = await ShowModel.findById(run.show).lean();
  const company = run.productionCompany
    ? await ProductionCompanyModel.findById(run.productionCompany).lean()
    : null;
  const venue = run.venues?.[0]
    ? await VenueModel.findById(run.venues[0]).lean()
    : null;

  const title = show?.title || "Production";
  const subtitle = [company?.name, venue?.name].filter(Boolean).join(" @ ");

  return {
    title: subtitle ? `${title} — ${subtitle}` : title,
    description: run.description || show?.description || `${title} on Curtn`,
    posterUrl: run.posterUrl || run.imageUrl || show?.posterUrl || show?.imageUrl || null,
  };
}

export async function getPerformanceMetadata(id: string) {
  await connectToDatabase();
  const { PerformanceModel } = require("../../../server/src/entities/performance/performanceModel");
  const { RunModel } = require("../../../server/src/entities/run/runModel");
  const { ShowModel } = require("../../../server/src/entities/show/showModel");
  const { VenueModel } = require("../../../server/src/entities/venue/venueModel");

  const perf = await PerformanceModel.findById(decodeId(id)).lean();
  if (!perf) return null;

  const run = await RunModel.findById(perf.run).lean();
  const show = run ? await ShowModel.findById(run.show).lean() : null;
  const venue = perf.venueId ? await VenueModel.findById(perf.venueId).lean() : null;

  const date = perf.date ? new Date(perf.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
  const title = show?.title || "Performance";

  return {
    title: `${title} — ${date}`,
    description: `${title}${venue ? ` at ${venue.name}` : ""}${date ? ` on ${date}` : ""} — on Curtn`,
    posterUrl: perf.metadataOverrides?.imageUrl || run?.posterUrl || show?.posterUrl || show?.imageUrl || null,
  };
}

export async function getVenueMetadata(slug: string) {
  await connectToDatabase();
  const { VenueModel } = require("../../../server/src/entities/venue/venueModel");
  const venue = await VenueModel.findOne({ slug }).lean();
  if (!venue) return null;
  return {
    title: venue.name,
    description: venue.description || `${venue.name}${venue.city ? ` in ${venue.city}` : ""} — on Curtn`,
    imageUrl: venue.imageUrl || null,
  };
}

export async function getPersonMetadata(slug: string) {
  await connectToDatabase();
  const { PersonModel } = require("../../../server/src/entities/person/personModel");
  const person = await PersonModel.findOne({ slug }).lean();
  if (!person) return null;
  return {
    title: person.name,
    description: person.bio || `${person.name} — on Curtn`,
    imageUrl: person.headshotUrl || null,
  };
}

export async function getCompanyMetadata(slug: string) {
  await connectToDatabase();
  const { ProductionCompanyModel } = require("../../../server/src/entities/productionCompany/productionCompanyModel");
  const company = await ProductionCompanyModel.findOne({ slug }).lean();
  if (!company) return null;
  return {
    title: company.name,
    description: company.description || `${company.name} — on Curtn`,
    imageUrl: company.logoUrl || null,
  };
}

export async function getUserMetadata(username: string) {
  await connectToDatabase();
  const { UserModel } = require("../../../server/src/entities/user/userModel");
  const user = await UserModel.findOne({ username }).lean();
  if (!user) return null;
  return {
    title: `@${user.username}`,
    description: user.bio || `${user.fullName} on Curtn`,
    imageUrl: user.avatarUrl || null,
  };
}
