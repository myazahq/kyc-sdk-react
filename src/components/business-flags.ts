// SVG flags for the business (KYB) registry countries. Explicit per-country
// imports keep the bundle to exactly the supported set (~50 small SVGs) —
// same philosophy as CountryFlag's core registry, which merges this in.
// Mirrors kyc-core's supported-country fallback catalogue.
import type React from 'react';
import AE from 'country-flag-icons/react/3x2/AE';
import AR from 'country-flag-icons/react/3x2/AR';
import AU from 'country-flag-icons/react/3x2/AU';
import BE from 'country-flag-icons/react/3x2/BE';
import BG from 'country-flag-icons/react/3x2/BG';
import BY from 'country-flag-icons/react/3x2/BY';
import CA from 'country-flag-icons/react/3x2/CA';
import CH from 'country-flag-icons/react/3x2/CH';
import CY from 'country-flag-icons/react/3x2/CY';
import CZ from 'country-flag-icons/react/3x2/CZ';
import DE from 'country-flag-icons/react/3x2/DE';
import DK from 'country-flag-icons/react/3x2/DK';
import EE from 'country-flag-icons/react/3x2/EE';
import FI from 'country-flag-icons/react/3x2/FI';
import FR from 'country-flag-icons/react/3x2/FR';
import GG from 'country-flag-icons/react/3x2/GG';
import GR from 'country-flag-icons/react/3x2/GR';
import IE from 'country-flag-icons/react/3x2/IE';
import IL from 'country-flag-icons/react/3x2/IL';
import IN from 'country-flag-icons/react/3x2/IN';
import JP from 'country-flag-icons/react/3x2/JP';
import KZ from 'country-flag-icons/react/3x2/KZ';
import LV from 'country-flag-icons/react/3x2/LV';
import MA from 'country-flag-icons/react/3x2/MA';
import MD from 'country-flag-icons/react/3x2/MD';
import MT from 'country-flag-icons/react/3x2/MT';
import NL from 'country-flag-icons/react/3x2/NL';
import NO from 'country-flag-icons/react/3x2/NO';
import NP from 'country-flag-icons/react/3x2/NP';
import NZ from 'country-flag-icons/react/3x2/NZ';
import PL from 'country-flag-icons/react/3x2/PL';
import PR from 'country-flag-icons/react/3x2/PR';
import RO from 'country-flag-icons/react/3x2/RO';
import SA from 'country-flag-icons/react/3x2/SA';
import SI from 'country-flag-icons/react/3x2/SI';
import SK from 'country-flag-icons/react/3x2/SK';
import TN from 'country-flag-icons/react/3x2/TN';
import TR from 'country-flag-icons/react/3x2/TR';
import TZ from 'country-flag-icons/react/3x2/TZ';
import UA from 'country-flag-icons/react/3x2/UA';
import UZ from 'country-flag-icons/react/3x2/UZ';
import YT from 'country-flag-icons/react/3x2/YT';

type FlagComponent = React.ComponentType<{
  title?: string;
  preserveAspectRatio?: string;
  className?: string;
}>;

export const BUSINESS_FLAGS: Record<string, FlagComponent> = {
  AE, AR, AU, BE, BG, BY, CA, CH, CY, CZ, DE, DK, EE, FI, FR, GG, GR, IE, IL,
  IN, JP, KZ, LV, MA, MD, MT, NL, NO, NP, NZ, PL, PR, RO, SA, SI, SK, TN, TR,
  TZ, UA, UZ, YT,
};
