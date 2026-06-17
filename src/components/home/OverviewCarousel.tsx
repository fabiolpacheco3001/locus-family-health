import * as React from "react";
import { Pill, Calendar, Stethoscope, FileText, ChevronRight, LayoutDashboard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { useNavigate } from "react-router-dom";

type Props = {
  activeMedsCount: number;
  totalOpenAppointments: number;
  pendingConsultations: number;
  pendingExams: number;
};

export function OverviewCarousel({
  activeMedsCount,
  totalOpenAppointments,
  pendingConsultations,
  pendingExams,
}: Props) {
  const navigate = useNavigate();
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [slideCount, setSlideCount] = React.useState(0);

  React.useEffect(() => {
    if (!carouselApi) return;
    setSlideCount(carouselApi.scrollSnapList().length);
    setCurrentSlide(carouselApi.selectedScrollSnap());
    carouselApi.on("select", () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    });
  }, [carouselApi]);

  const slides = [
    {
      icon: Pill,
      count: activeMedsCount,
      label: "Medicamentos Ativos",
      route: "/medicamentos",
    },
    {
      icon: Calendar,
      count: totalOpenAppointments,
      label: "Compromissos",
      route: "/agenda?filter=upcoming",
    },
    {
      icon: Stethoscope,
      count: pendingConsultations,
      label: "Consultas Pendentes",
      route: "/agenda?filter=consultas",
    },
    {
      icon: FileText,
      count: pendingExams,
      label: "Exames Pendentes",
      route: "/agenda?filter=exames",
    },
  ];

  return (
    <div>
      <h2 className="text-base font-semibold text-white/90 flex items-center gap-2 mb-3">
        <LayoutDashboard size={18} className="text-[#A7D3CB]" />
        Visão Geral
      </h2>
      <Carousel
        setApi={setCarouselApi}
        opts={{ align: "start", loop: true }}
        plugins={[Autoplay({ delay: 4000, stopOnInteraction: true })]}
        className="w-full"
      >
        <CarouselContent className="-ml-2">
          {slides.map(({ icon: Icon, count, label, route }) => (
            <CarouselItem key={label} className="pl-2 basis-full">
              <Card
                className="bg-white/10 backdrop-blur-md border border-white/20 cursor-pointer active:bg-white/15 sm:hover:bg-white/15 transition-colors rounded-2xl shadow-xs"
                onClick={() => navigate(route)}
              >
                <CardContent className="flex items-center justify-between w-full py-3 px-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-3xl font-bold text-white leading-none">{count}</span>
                      <span className="text-sm font-medium text-white/80 mt-1">{label}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/60" />
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div className="flex justify-center gap-1.5 mt-3">
        {Array.from({ length: slideCount }).map((_, i) => (
          <button
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === currentSlide ? "bg-white" : "bg-white/30"
            }`}
            onClick={() => carouselApi?.scrollTo(i)}
          />
        ))}
      </div>
    </div>
  );
}
