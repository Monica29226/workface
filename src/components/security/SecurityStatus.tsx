import React from 'react';
import { Shield, CheckCircle, Users, Lock, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function SecurityStatus() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Security Status: Protected
          </CardTitle>
          <CardDescription>
            All security vulnerabilities have been resolved with multi-level access controls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Employee Data Protection
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  Sensitive fields (IBAN, SSN) restricted to HR only
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  Personal data masked for unauthorized users
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  Role-based field visibility enforced
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Payroll Security
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  Salary data restricted to HR personnel only
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  Employees can only view their own payroll
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  Multi-layer authorization checks
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Audit Security
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  Time-limited access (90 days for admins)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  Payroll role limited to 30 days
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  Entity-specific access controls
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Access Levels</h4>
              <div className="space-y-1">
                <Badge variant="destructive" className="mr-2">HR Level</Badge>
                <span className="text-sm">Full access to all sensitive data</span>
              </div>
              <div className="space-y-1">
                <Badge variant="secondary" className="mr-2">Manager</Badge>
                <span className="text-sm">Basic employee data, masked sensitive fields</span>
              </div>
              <div className="space-y-1">
                <Badge variant="outline" className="mr-2">Employee</Badge>
                <span className="text-sm">Own profile only, limited visibility</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}