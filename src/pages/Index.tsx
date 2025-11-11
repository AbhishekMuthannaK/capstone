import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Video, Shield, Users, Lock, Calendar, FileText } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-soft">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-primary p-2 rounded-lg">
              <Video className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">AICTE Meetings</h1>
          </div>
          <Button 
            onClick={() => navigate("/auth")}
            className="bg-gradient-primary hover:opacity-90 transition-opacity"
          >
            Sign In
          </Button>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-5xl md:text-6xl font-bold text-foreground leading-tight">
              Secure Video Conferencing for AICTE
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A personalized online meeting platform designed for educational institutions, 
              faculty members, and ministry officials with enterprise-grade security.
            </p>
            <div className="flex gap-4 justify-center">
              <Button 
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-gradient-primary hover:opacity-90 transition-opacity text-lg px-8"
              >
                Get Started
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="text-lg px-8"
              >
                Learn More
              </Button>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-20">
          <h3 className="text-3xl font-bold text-center text-foreground mb-12">
            Built for Security & Collaboration
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card border border-border rounded-xl p-6 shadow-soft hover:shadow-medium transition-shadow">
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h4 className="text-xl font-semibold text-foreground mb-3">
                End-to-End Encryption
              </h4>
              <p className="text-muted-foreground">
                Military-grade encryption ensures all meetings and data remain confidential 
                and secure from unauthorized access.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-soft hover:shadow-medium transition-shadow">
              <div className="bg-secondary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-secondary" />
              </div>
              <h4 className="text-xl font-semibold text-foreground mb-3">
                Role-Based Access
              </h4>
              <p className="text-muted-foreground">
                Granular permission controls for administrators, faculty, HODs, and 
                ministry officials ensure proper access management.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-soft hover:shadow-medium transition-shadow">
              <div className="bg-accent/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Video className="w-6 h-6 text-accent" />
              </div>
              <h4 className="text-xl font-semibold text-foreground mb-3">
                HD Video & Audio
              </h4>
              <p className="text-muted-foreground">
                Crystal-clear video conferencing powered by WebRTC technology for 
                seamless real-time communication.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-soft hover:shadow-medium transition-shadow">
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h4 className="text-xl font-semibold text-foreground mb-3">
                Secure Storage
              </h4>
              <p className="text-muted-foreground">
                All meeting recordings and shared files are encrypted and stored 
                securely with compliance to data protection regulations.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-soft hover:shadow-medium transition-shadow">
              <div className="bg-secondary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Calendar className="w-6 h-6 text-secondary" />
              </div>
              <h4 className="text-xl font-semibold text-foreground mb-3">
                Smart Scheduling
              </h4>
              <p className="text-muted-foreground">
                Intuitive meeting scheduling with calendar integration and automated 
                notifications for all participants.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-soft hover:shadow-medium transition-shadow">
              <div className="bg-accent/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-accent" />
              </div>
              <h4 className="text-xl font-semibold text-foreground mb-3">
                Meeting Records
              </h4>
              <p className="text-muted-foreground">
                Comprehensive audit trails and meeting records for compliance and 
                future reference with secure access controls.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-gradient-primary py-20">
          <div className="container mx-auto px-4 text-center">
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to Transform Your Meetings?
            </h3>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Join AICTE's secure video conferencing platform and experience the 
              future of institutional collaboration.
            </p>
            <Button 
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-white text-primary hover:bg-white/90 text-lg px-8"
            >
              Create Your Account
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card/50 backdrop-blur-sm py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            © 2025 AICTE Meeting Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;