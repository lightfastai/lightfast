"use client";

import { TaskChooseOrganization } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function SelectOrganizationPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <TaskChooseOrganization
          afterSelectOrganizationUrl="http://localhost:4104/orgs/:orgId/dashboard"
          appearance={{
            baseTheme: dark,
            
            variables: {
              // Using shadcn dark mode colors with OKLCH values
              colorBackground: 'oklch(0.145 0 0)', // --background dark (same as page background)
              colorForeground: 'oklch(0.985 0 0)', // --card-foreground in dark mode
              colorPrimary: 'oklch(0.922 0 0)', // --primary in dark mode (light)
              colorPrimaryForeground: 'oklch(0.205 0 0)', // --primary-foreground in dark mode (dark)
              colorDanger: 'oklch(0.704 0.191 22.216)', // --destructive in dark mode
              colorSuccess: 'oklch(0.769 0.188 70.08)', // chart green
              colorWarning: 'oklch(0.828 0.189 84.429)', // chart yellow
              colorNeutral: 'oklch(0.708 0 0)', // --muted-foreground in dark mode
              colorInput: 'oklch(1 0 0 / 15%)', // --input in dark mode
              colorInputForeground: 'oklch(0.985 0 0)', // --foreground in dark mode
              colorBorder: 'oklch(1 0 0 / 10%)', // --border in dark mode
              colorMuted: 'oklch(0.269 0 0)', // --muted in dark mode
              colorMutedForeground: 'oklch(0.708 0 0)', // --muted-foreground
              colorRing: 'oklch(0.556 0 0)', // --ring in dark mode
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: '14px',
              borderRadius: '10px', // Using shadcn default --radius
              spacingUnit: '1rem'
            },
            
            elements: {
              card: {
                backgroundColor: 'oklch(0.145 0 0)', // --background dark (same as page background)
                border: 'none', // Remove border
                borderRadius: '0px', // Remove rounded corners
                boxShadow: 'none' // Remove shadow
              },
              cardBox: {
                padding: '2rem',
                backgroundColor: 'oklch(0.145 0 0)' // --background dark (same as page background)
              },
              headerTitle: {
                color: 'oklch(0.985 0 0)', // --card-foreground dark
                fontSize: '1.5rem',
                fontWeight: '600',
                marginBottom: '0.5rem'
              },
              headerSubtitle: {
                color: 'oklch(0.708 0 0)', // --muted-foreground dark
                fontSize: '0.875rem',
                marginBottom: '1.5rem'
              },
              formButtonPrimary: {
                // shadcn button default variant styling
                backgroundColor: 'oklch(0.922 0 0)', // --primary dark
                color: 'oklch(0.205 0 0)', // --primary-foreground dark
                borderRadius: '6px', // rounded-md
                fontSize: '0.875rem', // text-sm
                fontWeight: '500', // font-medium
                height: '48px', // h-12 (overridden from h-9)
                width: '100%', // w-full
                padding: '0.5rem 1rem', // px-4 py-2
                border: 'none',
                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', // shadow-xs
                transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)', // transition-all
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                whiteSpace: 'nowrap',
                '&:hover': {
                  backgroundColor: 'oklch(0.829 0 0)', // --primary/90
                },
                '&:focus-visible': {
                  outline: 'none',
                  borderColor: 'oklch(0.556 0 0)', // --ring
                  boxShadow: '0 0 0 3px oklch(0.556 0 0 / 0.5)' // ring-ring/50 ring-[3px]
                },
                '&:disabled': {
                  opacity: '0.5',
                  cursor: 'not-allowed'
                }
              },
              formButtonSecondary: {
                // shadcn button outline variant styling
                backgroundColor: 'oklch(0.145 0 0)', // --background dark
                color: 'oklch(0.985 0 0)', // --foreground dark
                border: '1px solid oklch(1 0 0 / 15%)', // --input dark border
                borderRadius: '6px', // rounded-md
                fontSize: '0.875rem', // text-sm
                fontWeight: '500', // font-medium
                height: '48px', // h-12 (overridden from h-9)
                width: '100%', // w-full
                padding: '0.5rem 1rem', // px-4 py-2
                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', // shadow-xs
                transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                whiteSpace: 'nowrap',
                '&:hover': {
                  backgroundColor: 'oklch(0.269 0 0)', // --accent dark
                  color: 'oklch(0.985 0 0)' // --accent-foreground dark
                },
                '&:focus-visible': {
                  outline: 'none',
                  borderColor: 'oklch(0.556 0 0)', // --ring
                  boxShadow: '0 0 0 3px oklch(0.556 0 0 / 0.5)' // ring-ring/50 ring-[3px]
                }
              },
              input: {
                // shadcn input styling with sign-in page overrides
                backgroundColor: 'oklch(0.145 0 0)', // bg-background (overridden from transparent)
                border: '1px solid oklch(1 0 0 / 15%)', // border-input dark
                borderRadius: '6px', // rounded-md
                color: 'oklch(0.985 0 0)', // --foreground dark
                fontSize: '0.875rem', // text-sm (md:text-sm)
                height: '48px', // h-12 (overridden from h-9)
                width: '100%',
                minWidth: '0',
                padding: '0.25rem 0.75rem', // px-3 py-1 (adjusted for h-12)
                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', // shadow-xs
                transition: 'color 150ms, box-shadow 150ms', // transition-[color,box-shadow]
                outline: 'none',
                '&:focus-visible': {
                  borderColor: 'oklch(0.556 0 0)', // --ring
                  boxShadow: '0 0 0 3px oklch(0.556 0 0 / 0.5)' // ring-ring/50 ring-[3px]
                },
                '&::placeholder': {
                  color: 'oklch(0.708 0 0)' // --muted-foreground dark
                },
                '&:disabled': {
                  opacity: '0.5',
                  cursor: 'not-allowed'
                }
              },
              organizationPreview: {
                border: 'none', // Remove border
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '0.75rem',
                backgroundColor: 'oklch(0.145 0 0)', // --background dark (same as page background)
                transition: 'all 0.2s ease-in-out',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'oklch(0.205 0 0)' // --card dark on hover for subtle feedback
                }
              },
              organizationPreviewAvatarBox: {
                width: '3rem',
                height: '3rem',
                borderRadius: '8px',
                backgroundColor: 'oklch(0.922 0 0)', // --primary dark
                marginRight: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'oklch(0.205 0 0)' // --primary-foreground dark
              },
              organizationPreviewTextContainer: {
                flex: '1'
              },
              organizationPreviewMainIdentifier: {
                fontSize: '1rem',
                fontWeight: '500',
                color: 'oklch(0.985 0 0)', // --card-foreground dark
                marginBottom: '0.25rem'
              },
              organizationPreviewSecondaryIdentifier: {
                fontSize: '0.875rem',
                color: 'oklch(0.708 0 0)' // --muted-foreground dark
              },
              footerActionText: {
                fontSize: '0.75rem', // text-xs
                color: 'oklch(0.708 0 0)', // --muted-foreground dark (same as T&C section)
                textAlign: 'center',
                backgroundColor: 'oklch(0.145 0 0)' // --background dark (same as page background)
              },
              footerActionLink: {
                fontSize: '0.75rem', // text-xs
                color: '#3b82f6', // blue-500 for link color
                textDecoration: 'underline',
                backgroundColor: 'oklch(0.145 0 0)', // --background dark (same as page background)
                '&:hover': {
                  color: '#2563eb' // blue-600 on hover
                }
              },
              footerActions: {
                backgroundColor: 'oklch(0.145 0 0)', // --background dark (same as page background)
                padding: '0.75rem'
              },
              footer: {
                backgroundColor: 'oklch(0.145 0 0)' // --background dark (same as page background)
              },
              rootBox: {
                backgroundColor: 'oklch(0.145 0 0)' // --background dark (same as page background)
              },
              main: {
                backgroundColor: 'oklch(0.145 0 0)' // --background dark (same as page background)
              }
            },
            
            layout: {
              logoImageUrl: null,
              showOptionalFields: true,
              logoPlacement: 'none'
            }
          }}
        />
      </div>
    </div>
  );
}