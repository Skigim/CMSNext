import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { User, Phone, MapPin, Calendar, FileText, Check, X, Users } from "lucide-react";
import { StoredCase } from "../../types/case";
import { formatDateForDisplay, formatUSPhone } from "@/domain/common";
import { CopyButton } from "../common/CopyButton";
import { Separator } from "../ui/separator";

interface CaseDetailsViewProps {
  caseData: StoredCase;
}

/**
 * CaseDetailsView - Clean read-only display of case information
 * 
 * Organized into clear card sections:
 * - Personal Information
 * - Contact Information
 * - Addresses (Physical & Mailing)
 * - Case Details
 * - Relationships
 * - Verification & Reviews
 */
export function CaseDetailsView({ caseData }: CaseDetailsViewProps) {
  const { person, caseRecord } = caseData;

  return (
    <div className="space-y-6">
      {/* 2-Column Grid for Main Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column */}
        <div className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow label="Full Name">
                <span className="font-medium">{person.firstName} {person.lastName}</span>
              </InfoRow>
              
              {person.dateOfBirth && (
                <InfoRow label="Date of Birth">
                  <CopyButton
                    value={person.dateOfBirth}
                    displayText={formatDateForDisplay(person.dateOfBirth)}
                    showLabel={false}
                    variant="plain"
                  />
                </InfoRow>
              )}
              
              {person.ssn && (
                <InfoRow label="SSN">
                  <CopyButton
                    value={person.ssn}
                    displayText="***-**-****"
                    showLabel={false}
                    variant="plain"
                    mono
                  />
                </InfoRow>
              )}
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-4 w-4" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {person.phone && (
                <InfoRow label="Phone">
                  <CopyButton
                    value={person.phone}
                    displayText={formatUSPhone(person.phone)}
                    showLabel={false}
                    variant="plain"
                  />
                </InfoRow>
              )}
              
              {person.email && (
                <InfoRow label="Email">
                  <CopyButton
                    value={person.email}
                    showLabel={false}
                    variant="plain"
                  />
                </InfoRow>
              )}
            </CardContent>
          </Card>

          {/* Addresses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                Addresses
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Physical Address */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Physical Address</h4>
                <AddressDisplay address={person.address} />
              </div>

              <Separator />

              {/* Mailing Address */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Mailing Address</h4>
                {person.mailingAddress?.sameAsPhysical ? (
                  <p className="text-sm text-muted-foreground italic">Same as physical address</p>
                ) : (
                  <AddressDisplay address={person.mailingAddress} />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Case Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Case Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {caseRecord.applicationDate && (
                <InfoRow label="Application Date">
                  <CopyButton
                    value={caseRecord.applicationDate}
                    displayText={formatDateForDisplay(caseRecord.applicationDate)}
                    showLabel={false}
                    variant="plain"
                  />
                </InfoRow>
              )}

              {caseRecord.caseType && (
                <InfoRow label="Case Type">
                  <Badge variant="secondary">{caseRecord.caseType}</Badge>
                </InfoRow>
              )}

              {caseRecord.applicationType && (
                <InfoRow label="Application Type">
                  <Badge variant="secondary">{caseRecord.applicationType}</Badge>
                </InfoRow>
              )}

              {caseRecord.livingArrangement && (
                <InfoRow label="Living Arrangement">
                  <span>{caseRecord.livingArrangement}</span>
                </InfoRow>
              )}

              {/* Flags */}
              <div className="pt-2 space-y-2">
                <ChecklistItem
                  label="Waiver Requested"
                  checked={!!caseRecord.withWaiver}
                />
                <ChecklistItem
                  label="Retro Requested"
                  checked={!!caseRecord.retroRequested}
                />
              </div>
            </CardContent>
          </Card>

          {/* Relationships */}
          {person.relationships && person.relationships.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  Relationships
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {person.relationships.map((rel, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-xs">
                        {rel.type || "Unknown"}
                      </Badge>
                      <span>{rel.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Verification & Reviews */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                Verification & Reviews
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Review dates and verification information will appear here.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper Components

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function AddressDisplay({ address }: { address?: { street?: string; city?: string; state?: string; zip?: string } }) {
  if (!address || !address.street) {
    return <p className="text-sm text-muted-foreground italic">No address provided</p>;
  }

  return (
    <div className="text-sm space-y-0.5">
      <p>{address.street}</p>
      <p>
        {address.city && <span>{address.city}</span>}
        {address.city && address.state && <span>, </span>}
        {address.state && <span>{address.state}</span>}
        {address.zip && <span> {address.zip}</span>}
      </p>
    </div>
  );
}

function ChecklistItem({ label, checked }: { label: string; checked?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {checked ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground/30" />
      )}
      <span className={checked ? "text-sm" : "text-sm text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}

export default CaseDetailsView;
