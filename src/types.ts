export type YesNo = "Yes" | "No";

export interface Applicant {
  scheme_country: string;
  personal: {
    family_name: string;
    given_name_1: string;
    given_name_2?: string;
    given_name_3?: string;
    other_names?: string;
    title: string;
    other_title?: string;
    gender: string;
    date_of_birth: string;
    country_of_birth: string;
  };
  address: {
    street_number: string;
    street_name: string;
    suburb: string;
    city: string;
    province: string;
    postal_code: string;
    country: string;
  };
  contact: {
    phone_daytime?: string;
    phone_night?: string;
    phone_mobile: string;
    fax?: string;
    email: string;
    communication_method: string;
    has_agent: YesNo | string;
    has_credit_card: YesNo | string;
  };
  identification: {
    passport_number: string;
    passport_expiry: string;
    id_type: string;
    id_issue_date: string;
    id_expiry_date: string;
  };
  occupation?: {
    industry_search?: string;
    occupation_search?: string;
  };
  health: {
    renal_dialysis: YesNo | string;
    active_tb: YesNo | string;
    cancer: YesNo | string;
    heart_disease: YesNo | string;
    disability: YesNo | string;
    hospitalisation: YesNo | string;
    residential_care: YesNo | string;
    pregnancy?: YesNo | string;
    tb_risk: YesNo | string;
    medical_details?: string;
  };
  character: {
    imprisonment_5_years: YesNo | string;
    imprisonment_12_months: YesNo | string;
    deported: YesNo | string;
    removal_order?: YesNo | string;
    charged: YesNo | string;
    convicted: YesNo | string;
    under_investigation: YesNo | string;
    excluded: YesNo | string;
    removed: YesNo | string;
    details?: string;
  };
  whs?: {
    previous_whs_visa?: YesNo | string;
    sufficient_funds_holiday?: YesNo | string;
    travel_date?: string;
    been_to_nz?: YesNo | string;
    been_to_nz_when?: string;
    sufficient_funds_onward_ticket?: YesNo | string;
    meet_scheme_requirements?: YesNo | string;
    length_of_stay?: string;
  };
  payment?: {
    payer_name?: string;
  };
  payer_name?: string;
}

export interface Credentials {
  username?: string;
  password?: string;
}

export interface TelegramSettings {
  enabled?: boolean;
  botToken?: string;
  chatId?: string;
}

export const DEFAULT_WHS = {
  previous_whs_visa: "No",
  sufficient_funds_holiday: "Yes",
  travel_date: "20 November, 2026",
  been_to_nz: "No",
  been_to_nz_when: "",
  sufficient_funds_onward_ticket: "Yes",
  meet_scheme_requirements: "Yes",
} as const;
