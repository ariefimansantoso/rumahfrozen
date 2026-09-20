"use client";

import posthog from "posthog-js";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Store,
  FileText,
  Globe,
  Landmark,
  Building2,
  MapPin,
  Hash,
  Phone,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast-notification";
import { authClient, signUp } from "@/lib/auth-client";
import { VENDOR_STATUS } from "@/config/app.config";
import { DEFAULT_STORE_NAME } from "@/config/branding.config";

// Validation schema
const vendorRegistrationSchema = z
  .object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Email is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    storeName: z.string().min(3, "Store name is required"),
    description: z.string().optional().or(z.literal("")),
    country: z.string().optional().or(z.literal("")),
    state: z.string().optional().or(z.literal("")),
    city: z.string().optional().or(z.literal("")),
    address: z.string().optional().or(z.literal("")),
    pincode: z.string().optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type VendorRegistrationFormData = z.infer<typeof vendorRegistrationSchema>;

interface VendorRegistrationFormProps {
  locale: string;
}

// All countries (ISO 3166-1)
const COUNTRIES = [
  { value: "AF", label: "Afghanistan" },
  { value: "AL", label: "Albania" },
  { value: "DZ", label: "Algeria" },
  { value: "AD", label: "Andorra" },
  { value: "AO", label: "Angola" },
  { value: "AG", label: "Antigua and Barbuda" },
  { value: "AR", label: "Argentina" },
  { value: "AM", label: "Armenia" },
  { value: "AU", label: "Australia" },
  { value: "AT", label: "Austria" },
  { value: "AZ", label: "Azerbaijan" },
  { value: "BS", label: "Bahamas" },
  { value: "BH", label: "Bahrain" },
  { value: "BD", label: "Bangladesh" },
  { value: "BB", label: "Barbados" },
  { value: "BY", label: "Belarus" },
  { value: "BE", label: "Belgium" },
  { value: "BZ", label: "Belize" },
  { value: "BJ", label: "Benin" },
  { value: "BT", label: "Bhutan" },
  { value: "BO", label: "Bolivia" },
  { value: "BA", label: "Bosnia and Herzegovina" },
  { value: "BW", label: "Botswana" },
  { value: "BR", label: "Brazil" },
  { value: "BN", label: "Brunei" },
  { value: "BG", label: "Bulgaria" },
  { value: "BF", label: "Burkina Faso" },
  { value: "BI", label: "Burundi" },
  { value: "KH", label: "Cambodia" },
  { value: "CM", label: "Cameroon" },
  { value: "CA", label: "Canada" },
  { value: "CV", label: "Cape Verde" },
  { value: "CF", label: "Central African Republic" },
  { value: "TD", label: "Chad" },
  { value: "CL", label: "Chile" },
  { value: "CN", label: "China" },
  { value: "CO", label: "Colombia" },
  { value: "KM", label: "Comoros" },
  { value: "CG", label: "Congo" },
  { value: "CR", label: "Costa Rica" },
  { value: "HR", label: "Croatia" },
  { value: "CU", label: "Cuba" },
  { value: "CY", label: "Cyprus" },
  { value: "CZ", label: "Czech Republic" },
  { value: "DK", label: "Denmark" },
  { value: "DJ", label: "Djibouti" },
  { value: "DM", label: "Dominica" },
  { value: "DO", label: "Dominican Republic" },
  { value: "EC", label: "Ecuador" },
  { value: "EG", label: "Egypt" },
  { value: "SV", label: "El Salvador" },
  { value: "GQ", label: "Equatorial Guinea" },
  { value: "ER", label: "Eritrea" },
  { value: "EE", label: "Estonia" },
  { value: "ET", label: "Ethiopia" },
  { value: "FJ", label: "Fiji" },
  { value: "FI", label: "Finland" },
  { value: "FR", label: "France" },
  { value: "GA", label: "Gabon" },
  { value: "GM", label: "Gambia" },
  { value: "GE", label: "Georgia" },
  { value: "DE", label: "Germany" },
  { value: "GH", label: "Ghana" },
  { value: "GR", label: "Greece" },
  { value: "GD", label: "Grenada" },
  { value: "GT", label: "Guatemala" },
  { value: "GN", label: "Guinea" },
  { value: "GW", label: "Guinea-Bissau" },
  { value: "GY", label: "Guyana" },
  { value: "HT", label: "Haiti" },
  { value: "HN", label: "Honduras" },
  { value: "HU", label: "Hungary" },
  { value: "IS", label: "Iceland" },
  { value: "IN", label: "India" },
  { value: "ID", label: "Indonesia" },
  { value: "IR", label: "Iran" },
  { value: "IQ", label: "Iraq" },
  { value: "IE", label: "Ireland" },
  { value: "IL", label: "Israel" },
  { value: "IT", label: "Italy" },
  { value: "JM", label: "Jamaica" },
  { value: "JP", label: "Japan" },
  { value: "JO", label: "Jordan" },
  { value: "KZ", label: "Kazakhstan" },
  { value: "KE", label: "Kenya" },
  { value: "KI", label: "Kiribati" },
  { value: "KP", label: "North Korea" },
  { value: "KR", label: "South Korea" },
  { value: "KW", label: "Kuwait" },
  { value: "KG", label: "Kyrgyzstan" },
  { value: "LA", label: "Laos" },
  { value: "LV", label: "Latvia" },
  { value: "LB", label: "Lebanon" },
  { value: "LS", label: "Lesotho" },
  { value: "LR", label: "Liberia" },
  { value: "LY", label: "Libya" },
  { value: "LI", label: "Liechtenstein" },
  { value: "LT", label: "Lithuania" },
  { value: "LU", label: "Luxembourg" },
  { value: "MK", label: "North Macedonia" },
  { value: "MG", label: "Madagascar" },
  { value: "MW", label: "Malawi" },
  { value: "MY", label: "Malaysia" },
  { value: "MV", label: "Maldives" },
  { value: "ML", label: "Mali" },
  { value: "MT", label: "Malta" },
  { value: "MH", label: "Marshall Islands" },
  { value: "MR", label: "Mauritania" },
  { value: "MU", label: "Mauritius" },
  { value: "MX", label: "Mexico" },
  { value: "FM", label: "Micronesia" },
  { value: "MD", label: "Moldova" },
  { value: "MC", label: "Monaco" },
  { value: "MN", label: "Mongolia" },
  { value: "ME", label: "Montenegro" },
  { value: "MA", label: "Morocco" },
  { value: "MZ", label: "Mozambique" },
  { value: "MM", label: "Myanmar" },
  { value: "NA", label: "Namibia" },
  { value: "NR", label: "Nauru" },
  { value: "NP", label: "Nepal" },
  { value: "NL", label: "Netherlands" },
  { value: "NZ", label: "New Zealand" },
  { value: "NI", label: "Nicaragua" },
  { value: "NE", label: "Niger" },
  { value: "NG", label: "Nigeria" },
  { value: "NO", label: "Norway" },
  { value: "OM", label: "Oman" },
  { value: "PK", label: "Pakistan" },
  { value: "PW", label: "Palau" },
  { value: "PA", label: "Panama" },
  { value: "PG", label: "Papua New Guinea" },
  { value: "PY", label: "Paraguay" },
  { value: "PE", label: "Peru" },
  { value: "PH", label: "Philippines" },
  { value: "PL", label: "Poland" },
  { value: "PT", label: "Portugal" },
  { value: "QA", label: "Qatar" },
  { value: "RO", label: "Romania" },
  { value: "RU", label: "Russia" },
  { value: "RW", label: "Rwanda" },
  { value: "KN", label: "Saint Kitts and Nevis" },
  { value: "LC", label: "Saint Lucia" },
  { value: "VC", label: "Saint Vincent and the Grenadines" },
  { value: "WS", label: "Samoa" },
  { value: "SM", label: "San Marino" },
  { value: "ST", label: "Sao Tome and Principe" },
  { value: "SA", label: "Saudi Arabia" },
  { value: "SN", label: "Senegal" },
  { value: "RS", label: "Serbia" },
  { value: "SC", label: "Seychelles" },
  { value: "SL", label: "Sierra Leone" },
  { value: "SG", label: "Singapore" },
  { value: "SK", label: "Slovakia" },
  { value: "SI", label: "Slovenia" },
  { value: "SB", label: "Solomon Islands" },
  { value: "SO", label: "Somalia" },
  { value: "ZA", label: "South Africa" },
  { value: "SS", label: "South Sudan" },
  { value: "ES", label: "Spain" },
  { value: "LK", label: "Sri Lanka" },
  { value: "SD", label: "Sudan" },
  { value: "SR", label: "Suriname" },
  { value: "SZ", label: "Eswatini" },
  { value: "SE", label: "Sweden" },
  { value: "CH", label: "Switzerland" },
  { value: "SY", label: "Syria" },
  { value: "TW", label: "Taiwan" },
  { value: "TJ", label: "Tajikistan" },
  { value: "TZ", label: "Tanzania" },
  { value: "TH", label: "Thailand" },
  { value: "TL", label: "Timor-Leste" },
  { value: "TG", label: "Togo" },
  { value: "TO", label: "Tonga" },
  { value: "TT", label: "Trinidad and Tobago" },
  { value: "TN", label: "Tunisia" },
  { value: "TR", label: "Turkey" },
  { value: "TM", label: "Turkmenistan" },
  { value: "TV", label: "Tuvalu" },
  { value: "UG", label: "Uganda" },
  { value: "UA", label: "Ukraine" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "UY", label: "Uruguay" },
  { value: "UZ", label: "Uzbekistan" },
  { value: "VU", label: "Vanuatu" },
  { value: "VA", label: "Vatican City" },
  { value: "VE", label: "Venezuela" },
  { value: "VN", label: "Vietnam" },
  { value: "YE", label: "Yemen" },
  { value: "ZM", label: "Zambia" },
  { value: "ZW", label: "Zimbabwe" },
];

// States/Provinces by country
const STATES: Record<string, { value: string; label: string }[]> = {
  IN: [
    { value: "AN", label: "Andaman and Nicobar Islands" },
    { value: "AP", label: "Andhra Pradesh" },
    { value: "AR", label: "Arunachal Pradesh" },
    { value: "AS", label: "Assam" },
    { value: "BR", label: "Bihar" },
    { value: "CH", label: "Chandigarh" },
    { value: "CT", label: "Chhattisgarh" },
    { value: "DN", label: "Dadra and Nagar Haveli" },
    { value: "DD", label: "Daman and Diu" },
    { value: "DL", label: "Delhi" },
    { value: "GA", label: "Goa" },
    { value: "GJ", label: "Gujarat" },
    { value: "HR", label: "Haryana" },
    { value: "HP", label: "Himachal Pradesh" },
    { value: "JK", label: "Jammu and Kashmir" },
    { value: "JH", label: "Jharkhand" },
    { value: "KA", label: "Karnataka" },
    { value: "KL", label: "Kerala" },
    { value: "LA", label: "Ladakh" },
    { value: "LD", label: "Lakshadweep" },
    { value: "MP", label: "Madhya Pradesh" },
    { value: "MH", label: "Maharashtra" },
    { value: "MN", label: "Manipur" },
    { value: "ML", label: "Meghalaya" },
    { value: "MZ", label: "Mizoram" },
    { value: "NL", label: "Nagaland" },
    { value: "OR", label: "Odisha" },
    { value: "PY", label: "Puducherry" },
    { value: "PB", label: "Punjab" },
    { value: "RJ", label: "Rajasthan" },
    { value: "SK", label: "Sikkim" },
    { value: "TN", label: "Tamil Nadu" },
    { value: "TG", label: "Telangana" },
    { value: "TR", label: "Tripura" },
    { value: "UP", label: "Uttar Pradesh" },
    { value: "UK", label: "Uttarakhand" },
    { value: "WB", label: "West Bengal" },
  ],
  US: [
    { value: "AL", label: "Alabama" },
    { value: "AK", label: "Alaska" },
    { value: "AZ", label: "Arizona" },
    { value: "AR", label: "Arkansas" },
    { value: "CA", label: "California" },
    { value: "CO", label: "Colorado" },
    { value: "CT", label: "Connecticut" },
    { value: "DE", label: "Delaware" },
    { value: "FL", label: "Florida" },
    { value: "GA", label: "Georgia" },
    { value: "HI", label: "Hawaii" },
    { value: "ID", label: "Idaho" },
    { value: "IL", label: "Illinois" },
    { value: "IN", label: "Indiana" },
    { value: "IA", label: "Iowa" },
    { value: "KS", label: "Kansas" },
    { value: "KY", label: "Kentucky" },
    { value: "LA", label: "Louisiana" },
    { value: "ME", label: "Maine" },
    { value: "MD", label: "Maryland" },
    { value: "MA", label: "Massachusetts" },
    { value: "MI", label: "Michigan" },
    { value: "MN", label: "Minnesota" },
    { value: "MS", label: "Mississippi" },
    { value: "MO", label: "Missouri" },
    { value: "MT", label: "Montana" },
    { value: "NE", label: "Nebraska" },
    { value: "NV", label: "Nevada" },
    { value: "NH", label: "New Hampshire" },
    { value: "NJ", label: "New Jersey" },
    { value: "NM", label: "New Mexico" },
    { value: "NY", label: "New York" },
    { value: "NC", label: "North Carolina" },
    { value: "ND", label: "North Dakota" },
    { value: "OH", label: "Ohio" },
    { value: "OK", label: "Oklahoma" },
    { value: "OR", label: "Oregon" },
    { value: "PA", label: "Pennsylvania" },
    { value: "RI", label: "Rhode Island" },
    { value: "SC", label: "South Carolina" },
    { value: "SD", label: "South Dakota" },
    { value: "TN", label: "Tennessee" },
    { value: "TX", label: "Texas" },
    { value: "UT", label: "Utah" },
    { value: "VT", label: "Vermont" },
    { value: "VA", label: "Virginia" },
    { value: "WA", label: "Washington" },
    { value: "WV", label: "West Virginia" },
    { value: "WI", label: "Wisconsin" },
    { value: "WY", label: "Wyoming" },
  ],
  CA: [
    { value: "AB", label: "Alberta" },
    { value: "BC", label: "British Columbia" },
    { value: "MB", label: "Manitoba" },
    { value: "NB", label: "New Brunswick" },
    { value: "NL", label: "Newfoundland and Labrador" },
    { value: "NS", label: "Nova Scotia" },
    { value: "ON", label: "Ontario" },
    { value: "PE", label: "Prince Edward Island" },
    { value: "QC", label: "Quebec" },
    { value: "SK", label: "Saskatchewan" },
  ],
  GB: [
    { value: "ENG", label: "England" },
    { value: "SCT", label: "Scotland" },
    { value: "WLS", label: "Wales" },
    { value: "NIR", label: "Northern Ireland" },
  ],
  AU: [
    { value: "NSW", label: "New South Wales" },
    { value: "VIC", label: "Victoria" },
    { value: "QLD", label: "Queensland" },
    { value: "WA", label: "Western Australia" },
    { value: "SA", label: "South Australia" },
    { value: "TAS", label: "Tasmania" },
    { value: "ACT", label: "Australian Capital Territory" },
    { value: "NT", label: "Northern Territory" },
  ],
  BD: [
    { value: "BAR", label: "Barisal" },
    { value: "CHT", label: "Chittagong" },
    { value: "DHK", label: "Dhaka" },
    { value: "KHU", label: "Khulna" },
    { value: "MYM", label: "Mymensingh" },
    { value: "RAJ", label: "Rajshahi" },
    { value: "RNG", label: "Rangpur" },
    { value: "SYL", label: "Sylhet" },
  ],
  PK: [
    { value: "PB", label: "Punjab" },
    { value: "SD", label: "Sindh" },
    { value: "KP", label: "Khyber Pakhtunkhwa" },
    { value: "BA", label: "Balochistan" },
    { value: "IS", label: "Islamabad Capital Territory" },
    { value: "GB", label: "Gilgit-Baltistan" },
    { value: "AK", label: "Azad Kashmir" },
  ],
};

// Phone codes with country
const PHONE_CODES = [
  { value: "+1", label: "+1 (US/CA)" },
  { value: "+44", label: "+44 (UK)" },
  { value: "+91", label: "+91 (India)" },
  { value: "+86", label: "+86 (China)" },
  { value: "+81", label: "+81 (Japan)" },
  { value: "+49", label: "+49 (Germany)" },
  { value: "+33", label: "+33 (France)" },
  { value: "+39", label: "+39 (Italy)" },
  { value: "+34", label: "+34 (Spain)" },
  { value: "+61", label: "+61 (Australia)" },
  { value: "+55", label: "+55 (Brazil)" },
  { value: "+7", label: "+7 (Russia)" },
  { value: "+82", label: "+82 (S. Korea)" },
  { value: "+52", label: "+52 (Mexico)" },
  { value: "+62", label: "+62 (Indonesia)" },
  { value: "+90", label: "+90 (Turkey)" },
  { value: "+966", label: "+966 (Saudi)" },
  { value: "+971", label: "+971 (UAE)" },
  { value: "+880", label: "+880 (BD)" },
  { value: "+92", label: "+92 (Pakistan)" },
  { value: "+234", label: "+234 (Nigeria)" },
  { value: "+27", label: "+27 (S. Africa)" },
  { value: "+20", label: "+20 (Egypt)" },
  { value: "+63", label: "+63 (Philippines)" },
  { value: "+84", label: "+84 (Vietnam)" },
  { value: "+66", label: "+66 (Thailand)" },
  { value: "+60", label: "+60 (Malaysia)" },
  { value: "+65", label: "+65 (Singapore)" },
  { value: "+977", label: "+977 (Nepal)" },
  { value: "+94", label: "+94 (Sri Lanka)" },
];

// Country (ISO 3166-1 alpha-2) -> international dialing code
const COUNTRY_DIAL_CODES: Record<string, string> = {
  AF: "+93", AL: "+355", DZ: "+213", AD: "+376", AO: "+244", AG: "+1268",
  AR: "+54", AM: "+374", AU: "+61", AT: "+43", AZ: "+994", BS: "+1242",
  BH: "+973", BD: "+880", BB: "+1246", BY: "+375", BE: "+32", BZ: "+501",
  BJ: "+229", BT: "+975", BO: "+591", BA: "+387", BW: "+267", BR: "+55",
  BN: "+673", BG: "+359", BF: "+226", BI: "+257", KH: "+855", CM: "+237",
  CA: "+1", CV: "+238", CF: "+236", TD: "+235", CL: "+56", CN: "+86",
  CO: "+57", KM: "+269", CG: "+242", CR: "+506", HR: "+385", CU: "+53",
  CY: "+357", CZ: "+420", DK: "+45", DJ: "+253", DM: "+1767", DO: "+1809",
  EC: "+593", EG: "+20", SV: "+503", GQ: "+240", ER: "+291", EE: "+372",
  ET: "+251", FJ: "+679", FI: "+358", FR: "+33", GA: "+241", GM: "+220",
  GE: "+995", DE: "+49", GH: "+233", GR: "+30", GD: "+1473", GT: "+502",
  GN: "+224", GW: "+245", GY: "+592", HT: "+509", HN: "+504", HU: "+36",
  IS: "+354", IN: "+91", ID: "+62", IR: "+98", IQ: "+964", IE: "+353",
  IL: "+972", IT: "+39", JM: "+1876", JP: "+81", JO: "+962", KZ: "+7",
  KE: "+254", KI: "+686", KP: "+850", KR: "+82", KW: "+965", KG: "+996",
  LA: "+856", LV: "+371", LB: "+961", LS: "+266", LR: "+231", LY: "+218",
  LI: "+423", LT: "+370", LU: "+352", MK: "+389", MG: "+261", MW: "+265",
  MY: "+60", MV: "+960", ML: "+223", MT: "+356", MH: "+692", MR: "+222",
  MU: "+230", MX: "+52", FM: "+691", MD: "+373", MC: "+377", MN: "+976",
  ME: "+382", MA: "+212", MZ: "+258", MM: "+95", NA: "+264", NR: "+674",
  NP: "+977", NL: "+31", NZ: "+64", NI: "+505", NE: "+227", NG: "+234",
  NO: "+47", OM: "+968", PK: "+92", PW: "+680", PA: "+507", PG: "+675",
  PY: "+595", PE: "+51", PH: "+63", PL: "+48", PT: "+351", QA: "+974",
  RO: "+40", RU: "+7", RW: "+250", KN: "+1869", LC: "+1758", VC: "+1784",
  WS: "+685", SM: "+378", ST: "+239", SA: "+966", SN: "+221", RS: "+381",
  SC: "+248", SL: "+232", SG: "+65", SK: "+421", SI: "+386", SB: "+677",
  SO: "+252", ZA: "+27", SS: "+211", ES: "+34", LK: "+94", SD: "+249",
  SR: "+597", SZ: "+268", SE: "+46", CH: "+41", SY: "+963", TW: "+886",
  TJ: "+992", TZ: "+255", TH: "+66", TL: "+670", TG: "+228", TO: "+676",
  TT: "+1868", TN: "+216", TR: "+90", TM: "+993", TV: "+688", UG: "+256",
  UA: "+380", AE: "+971", GB: "+44", US: "+1", UY: "+598", UZ: "+998",
  VU: "+678", VA: "+379", VE: "+58", VN: "+84", YE: "+967", ZM: "+260",
  ZW: "+263",
};

export function VendorRegistrationForm({
  locale,
}: VendorRegistrationFormProps) {
  const t = useTranslations("vendor.registration");
  const tAuth = useTranslations("auth");
  const tVendor = useTranslations("vendor");
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [phoneCode, setPhoneCode] = useState("+91");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [existingApplication, setExistingApplication] = useState<{
    hasApplication: boolean;
    status: string | null;
    vendor?: any;
  } | null>(null);

  const form = useForm<VendorRegistrationFormData>({
    resolver: zodResolver(vendorRegistrationSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      storeName: "",
      description: "",
      country: "",
      state: "",
      city: "",
      address: "",
      pincode: "",
      phone: "",
    },
  });

  const selectedCountry = form.watch("country");
  const availableStates = selectedCountry ? STATES[selectedCountry] || [] : [];

  // Auto-fill the phone dialing code when a country is selected
  useEffect(() => {
    const dialCode = selectedCountry && COUNTRY_DIAL_CODES[selectedCountry];
    if (dialCode) {
      setPhoneCode(dialCode);
    }
  }, [selectedCountry]);

  // Ensure the phone-code select can always display the current code,
  // even if it isn't part of the shortlisted PHONE_CODES options.
  const phoneCodeOptions = useMemo(() => {
    if (!phoneCode || PHONE_CODES.some((c) => c.value === phoneCode))
      return PHONE_CODES;
    return [{ value: phoneCode, label: phoneCode }, ...PHONE_CODES];
  }, [phoneCode]);

  useEffect(() => {
    async function checkStatus() {
      try {
        const { data: session } = await authClient.getSession();
        const loggedIn = !!session?.user;
        setIsLoggedIn(loggedIn);

        if (loggedIn) {
          const res = await fetch("/api/vendor/apply");
          const data = await res.json();
          if (data.success) {
            setExistingApplication(data.data);
          }
        }
      } catch (error) {
        console.error("Failed to check status:", error);
      } finally {
        setIsLoading(false);
      }
    }
    checkStatus();
  }, []);

  const onSubmit = async (data: VendorRegistrationFormData) => {
    setIsSubmitting(true);
    try {
      if (!isLoggedIn) {
        const result = await signUp.email({
          name: data.name,
          email: data.email,
          password: data.password,
          emailVerificationAudience: "vendor",
        } as Parameters<typeof signUp.email>[0] & {
          emailVerificationAudience: "vendor";
        });

        if (result.error) {
          toast.error(result.error.message || "Failed to create account");
          setIsSubmitting(false);
          return;
        }

        setIsLoggedIn(true);
        toast.success("Account created successfully!");
      }

      const payload = {
        storeName: data.storeName,
        description: data.description || `New store on ${DEFAULT_STORE_NAME}`,
        logo: null,
        banner: null,
        address: data.address
          ? {
              street: data.address,
              city: data.city,
              state: data.state,
              postalCode: data.pincode,
              country: data.country,
              phone: data.phone ? `${phoneCode}${data.phone}` : "",
            }
          : null,
        socialLinks: null,
        bankDetails: null,
      };

      const res = await fetch("/api/vendor/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        posthog.capture("vendor_registration_submitted", {
          store_name: data.storeName,
          country: data.country,
        });
        toast.success(t("applicationSubmitted"));
        setExistingApplication({
          hasApplication: true,
          status: VENDOR_STATUS.PENDING,
          vendor: result.data?.vendor,
        });
      } else {
        toast.error(result.message || "Failed to submit application");
      }
    } catch (error) {
      toast.error("An error occurred while submitting your application");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (existingApplication?.hasApplication) {
    const status = existingApplication.status;
    return (
      <Card className="border shadow-sm">
        <CardContent className="pt-8 pb-8 text-center">
          {status === VENDOR_STATUS.PENDING && (
            <>
              <div className="inline-flex p-3 rounded-full bg-amber-100 mb-4">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">
                {t("applicationPending")}
              </h3>
              <p className="text-sm text-gray-500">
                {t("applicationPendingDesc")}
              </p>
            </>
          )}
          {status === VENDOR_STATUS.APPROVED && (
            <>
              <div className="inline-flex p-3 rounded-full bg-green-100 mb-4">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">
                {t("applicationApproved")}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {t("applicationApprovedDesc")}
              </p>
              <Button asChild>
                <a href={`/${locale}/vendor/dashboard`}>
                  {tVendor("goToDashboard")}{" "}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </>
          )}
          {(status === VENDOR_STATUS.REJECTED ||
            status === VENDOR_STATUS.SUSPENDED) && (
            <>
              <div className="inline-flex p-3 rounded-full bg-red-100 mb-4">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">
                {status === VENDOR_STATUS.REJECTED
                  ? t("applicationRejected")
                  : t("applicationSuspended")}
              </h3>
              <p className="text-sm text-gray-500">
                {status === VENDOR_STATUS.REJECTED
                  ? t("applicationRejectedDesc")
                  : t("applicationSuspendedDesc")}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
        {/* Name & Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  {tAuth("fullName")}{" "}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter your full name"
                      className="h-10 pl-10"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  {tAuth("email")} <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      className="h-10 pl-10"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>

        {/* Password */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  {tAuth("password")} <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      className="h-10 pl-10 pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  {t("confirmPassword")}{" "}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm password"
                      className="h-10 pl-10 pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      tabIndex={-1}
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>

        {/* Store Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="storeName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  {t("storeNameLabel")}{" "}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Store className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter your store name"
                      className="h-10 pl-10"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  {t("storeDescLabel")}
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <FileText className="pointer-events-none absolute left-3 top-[14px] h-4 w-4 text-muted-foreground" />
                    <Textarea
                      placeholder="Tell customers about your store"
                      className="min-h-[44px] h-10 py-2.5 pl-10 resize-none"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>

        {/* Location */}
        <div className="grid grid-cols-3 gap-3">
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  Country
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="h-10 w-full">
                      <div className="flex min-w-0 items-center gap-2">
                        <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <SelectValue placeholder="Select country" />
                      </div>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {COUNTRIES.filter((c) => c.value).map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  State
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  disabled={availableStates.length === 0}
                >
                  <FormControl>
                    <SelectTrigger className="h-10 w-full">
                      <div className="flex min-w-0 items-center gap-2">
                        <Landmark className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <SelectValue placeholder="Select state" />
                      </div>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableStates.filter((s) => s.value).map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  City
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter city"
                      className="h-10 pl-10"
                      {...field}
                    />
                  </div>
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* Address */}
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-foreground">
                Address
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Enter your complete address"
                    className="h-10 pl-10"
                    {...field}
                  />
                </div>
              </FormControl>
            </FormItem>
          )}
        />

        {/* Pincode & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="pincode"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">
                  Pincode
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Hash className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter pincode"
                      className="h-10 pl-10"
                      {...field}
                    />
                  </div>
                </FormControl>
              </FormItem>
            )}
          />
          <FormItem>
            <FormLabel className="text-sm font-medium text-foreground">
              Phone
            </FormLabel>
            <div className="flex gap-2">
              <Select value={phoneCode} onValueChange={setPhoneCode}>
                <SelectTrigger className="w-20 shrink-0 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {phoneCodeOptions.filter((c) => c.value).map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormControl>
                    <div className="relative flex-1">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Enter phone number"
                        className="h-10 pl-10 w-full"
                        {...field}
                      />
                    </div>
                  </FormControl>
                )}
              />
            </div>
          </FormItem>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-11 rounded-xl text-base font-semibold bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/25 hover:from-primary/95 hover:to-primary/75"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating your store...
            </>
          ) : (
            t("submitButton")
          )}
        </Button>

        {/* Login link */}
        <p className="text-center text-sm text-muted-foreground">
          {tAuth("hasAccount")}{" "}
          <Link
            href={`/${locale}/login?callbackUrl=/${locale}/become-vendor`}
            className="text-primary font-medium hover:underline"
          >
            {tAuth("signIn")}
          </Link>
        </p>
      </form>
    </Form>
  );
}
