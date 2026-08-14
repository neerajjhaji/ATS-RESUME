/**
 * Target-location catalog for job search: Remote + India Tier-1 cities + all
 * states & union territories. Used by the Career Intelligence dashboard and the
 * AI Career Agent to scope discovery/matching.
 */

export interface LocationGroup {
  label: string;
  options: string[];
}

export const LOCATION_GROUPS: LocationGroup[] = [
  {
    label: "Anywhere",
    options: ["Remote"],
  },
  {
    label: "Tier 1 Cities",
    options: [
      "Mumbai",
      "Navi Mumbai",
      "Delhi",
      "New Delhi",
      "Bengaluru",
      "Hyderabad",
      "Chennai",
      "Kolkata",
      "Pune",
      "Ahmedabad",
      "Gurugram",
      "Noida",
    ],
  },
  {
    label: "States & Union Territories",
    options: [
      "Andhra Pradesh",
      "Arunachal Pradesh",
      "Assam",
      "Bihar",
      "Chhattisgarh",
      "Goa",
      "Gujarat",
      "Haryana",
      "Himachal Pradesh",
      "Jharkhand",
      "Karnataka",
      "Kerala",
      "Madhya Pradesh",
      "Maharashtra",
      "Manipur",
      "Meghalaya",
      "Mizoram",
      "Nagaland",
      "Odisha",
      "Punjab",
      "Rajasthan",
      "Sikkim",
      "Tamil Nadu",
      "Telangana",
      "Tripura",
      "Uttar Pradesh",
      "Uttarakhand",
      "West Bengal",
      "Andaman and Nicobar Islands",
      "Chandigarh",
      "Dadra and Nagar Haveli and Daman and Diu",
      "Jammu and Kashmir",
      "Ladakh",
      "Lakshadweep",
      "Puducherry",
    ],
  },
];

/** Flat list of every selectable location, in group order. */
export const ALL_LOCATIONS: string[] = LOCATION_GROUPS.flatMap((g) => g.options);

/** Sensible starting selection. */
export const DEFAULT_LOCATIONS: string[] = ["Navi Mumbai", "Mumbai", "Remote"];
