"use client";

import * as React from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { SignInForm } from "./sign-in-form";

export function SignInPageWrapper() {
	const [verificationStep, setVerificationStep] = React.useState<'email' | 'code'>('email');
	const [hasError, setHasError] = React.useState(false);

	function handleReset() {
		setVerificationStep('email');
		setHasError(false);
	}

	function handleVerificationStepChange(step: 'email' | 'code') {
		console.log('Changing verification step to:', step);
		setVerificationStep(step);
		if (step === 'email') {
			setHasError(false);
		}
	}

	console.log('Current verification step:', verificationStep, 'Has error:', hasError);
	
	return (
		<>
			{/* Back Button - positioned absolutely in the grid container */}
			{verificationStep === 'code' && !hasError && (
				<div className="absolute top-4 left-4 lg:top-8 lg:left-8 z-10">
					<Button
						onClick={handleReset}
						variant="ghost"
						size="icon"
						className="h-8 w-8"
					>
						<Icons.arrowLeft className="h-4 w-4" />
						<span className="sr-only">Back to email</span>
					</Button>
				</div>
			)}
			
			<SignInForm 
				verificationStep={verificationStep}
				onVerificationStepChange={handleVerificationStepChange}
			/>
		</>
	);
}