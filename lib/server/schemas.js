import { z } from 'zod';

// Password criteria regex: min 8 chars, at least one letter, number, and special character
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

export const RegisterUserSchema = z.object({
  username: z.string().min(2).max(50).transform(val => val.toLowerCase().trim()),
  password: z.string().regex(passwordRegex, {
    message: 'Password must be at least 8 characters long and include a letter, a number, and a special character.'
  }),
  display_name: z.string().min(2).max(100).transform(val => val.trim()),
  email: z.string().email().or(z.literal('')).optional().transform(val => val ? val.toLowerCase().trim() : ''),
  mobile: z.string().optional().transform(val => val ? val.trim() : '')
});

export const LoginUserSchema = z.object({
  username: z.string().min(1).transform(val => val.toLowerCase().trim()),
  password: z.string().min(1)
});

export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().regex(passwordRegex, {
    message: 'New password must be at least 8 characters long and include a letter, a number, and a special character.'
  })
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email().transform(val => val.toLowerCase().trim())
});

export const ResetPasswordSchema = z.object({
  email: z.string().email().transform(val => val.toLowerCase().trim()),
  token: z.string().min(1),
  password: z.string().regex(passwordRegex, {
    message: 'Password must be at least 8 characters long and include a letter, a number, and a special character.'
  })
});

export const UserRoleSchema = z.object({
  role: z.enum(['admin', 'staff', 'ca'])
});

export const UserStatusSchema = z.object({
  is_active: z.boolean()
});

export const UpdateUserSchema = z.object({
  username: z.string().min(2).max(50).transform(val => val.toLowerCase().trim()),
  display_name: z.string().min(2).max(100).transform(val => val.trim()),
  email: z.string().email().or(z.literal('')).optional().transform(val => val ? val.toLowerCase().trim() : ''),
  mobile: z.string().optional().transform(val => val ? val.trim() : '')
});

export const ProfileUpdateSchema = z.object({
  display_name: z.string().min(2).max(100).transform(val => val.trim()),
  email: z.string().email().or(z.literal('')).optional().transform(val => val ? val.toLowerCase().trim() : ''),
  mobile: z.string().optional().transform(val => val ? val.trim() : ''),
  current_password: z.string().optional().or(z.literal('')),
  new_password: z.string().optional().or(z.literal(''))
}).superRefine((data, ctx) => {
  if (data.new_password && !data.current_password) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Current password is required to change password',
      path: ['current_password']
    });
  }
  if (data.new_password && !passwordRegex.test(data.new_password)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'New password must be at least 8 characters and contain a letter, a number, and a special character',
      path: ['new_password']
    });
  }
});

export const BusinessConfigSchema = z.object({
  name: z.string().min(1).max(200).transform(val => val.trim()),
  gstin: z.string().max(15).or(z.literal('')).optional().transform(val => val ? val.toUpperCase().trim() : ''),
  address: z.string().max(500).or(z.literal('')).optional().transform(val => val ? val.trim() : ''),
  state_code: z.string().max(5).or(z.literal('')).optional().transform(val => val ? val.trim() : ''),
  phone: z.string().max(20).or(z.literal('')).optional().transform(val => val ? val.trim() : ''),
  email: z.string().email().or(z.literal('')).optional().transform(val => val ? val.toLowerCase().trim() : ''),
  terms: z.string().max(1000).or(z.literal('')).optional().transform(val => val ? val.trim() : ''),
  send_emails: z.boolean().optional().default(true)
});

export const CustomerSchema = z.object({
  name: z.string().min(1).max(200).transform(val => val.trim()),
  gstin: z.string().max(15).or(z.literal('')).optional().transform(val => val ? val.toUpperCase().trim() : ''),
  address: z.string().max(500).or(z.literal('')).optional().transform(val => val ? val.trim() : ''),
  state_code: z.string().max(5).or(z.literal('')).optional().transform(val => val ? val.trim() : ''),
  phone: z.string().max(20).or(z.literal('')).optional().transform(val => val ? val.trim() : ''),
  email: z.string().email().or(z.literal('')).optional().transform(val => val ? val.toLowerCase().trim() : '')
});

export const ProductSchema = z.object({
  description: z.string().min(1).max(200).transform(val => val.trim()),
  hsn_sac: z.string().max(10).or(z.literal('')).optional().transform(val => val ? val.trim() : ''),
  unit: z.string().max(20).or(z.literal('')).optional().default('Nos'),
  rate: z.coerce.number().nonnegative().default(0),
  gst_rate: z.coerce.number().nonnegative().default(18),
  qty_per_unit: z.coerce.number().positive().default(1)
});

export const ProductReorderSchema = z.array(
  z.object({
    id: z.coerce.number(),
    sort_order: z.coerce.number()
  })
);

export const InvoiceItemSchema = z.object({
  description: z.string().min(1).max(200).transform(val => val.trim()),
  hsn_sac: z.string().max(10).or(z.literal('')).optional().transform(val => val ? val.trim() : ''),
  qty: z.coerce.number().positive(),
  unit: z.string().max(20).default('Nos'),
  rate: z.coerce.number().nonnegative(),
  discount_percent: z.coerce.number().nonnegative().default(0),
  gst_rate: z.coerce.number().nonnegative().default(18),
  qty_per_unit: z.coerce.number().positive().default(1)
});

export const InvoiceSchema = z.object({
  invoice_number: z.string().min(1).max(50).transform(val => val.trim()),
  invoice_date: z.string().min(1),
  due_date: z.string().or(z.literal('')).optional().transform(val => val || null),
  place_of_supply: z.string().min(1).max(5),
  supply_type: z.enum(['intra', 'inter']),
  buyer_name: z.string().min(1).max(200).transform(val => val.trim()),
  buyer_gstin: z.string().max(15).or(z.literal('')).optional().transform(val => val ? val.toUpperCase().trim() : ''),
  buyer_address: z.string().max(500).or(z.literal('')).optional().transform(val => val ? val.trim() : ''),
  buyer_state: z.string().max(5).or(z.literal('')).optional().transform(val => val ? val.trim() : ''),
  buyer_phone: z.string().max(20).or(z.literal('')).optional().transform(val => val ? val.trim() : ''),
  buyer_email: z.string().email().or(z.literal('')).optional().transform(val => val ? val.toLowerCase().trim() : ''),
  notes: z.string().max(1000).or(z.literal('')).optional().transform(val => val ? val.trim() : ''),
  items: z.array(InvoiceItemSchema).min(1)
});

export const ShareInvoiceSchema = z.object({
  // No payload or empty object
}).optional();

export const EmailInvoiceSchema = z.object({
  // Send invoice email endpoint usually triggers reset/send automatically without custom input, or checks.
  // We check if any parameters are passed.
}).optional();
